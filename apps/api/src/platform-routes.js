'use strict';

const { listIcons, renderIcon } = require('../../../packages/icons/src/catalog');
const { renderMath } = require('../../../packages/math/src/renderer');
const { validateProfile, validateGroup, cleanText } = require('../../../packages/community/src/validation');
const { validateIpPattern } = require('../../../packages/security/src/firewall');
const { cloudConfigStatus, createCloudStorageAdapterFromEnv, probeCloudStorageAdapter, resolveCloudCredentialReference, cloudEndpointAllowed } = require('../../../packages/cloud/src/storage-adapters');
const { validateMenuItems } = require('../../../packages/domain/src/navigation');
const { handleCommunityWorkflowRoute } = require('../../../packages/community/src/workflows');
const { handleCommerceRoute, productInput } = require('./commerce-routes');
const { handleLibraryRoute } = require('./library-routes');
const { isBoundedJsonObject } = require('./request-validation');
const { isUuid } = require('../../../packages/domain/src/identifiers');
const { withTransaction } = require('../../../packages/db/src/transaction');

const validUuid = isUuid;

/**
 * Build the shared site/group/visibility predicate for a community activity.
 * The aliases and parameter placeholder are source-controlled SQL fragments;
 * request values remain bound parameters.
 */
function communityActivityVisibilitySql(activityAlias, groupAlias, actorParameter) {
  return `(
    ${activityAlias}.visibility IN ('public','members','private','group')
    AND (
      (${activityAlias}.group_id IS NOT NULL
        AND ${groupAlias}.privacy IN ('private','hidden')
        AND EXISTS (
          SELECT 1 FROM social_group_memberships gm
          WHERE gm.group_id=${activityAlias}.group_id
            AND gm.user_id=${actorParameter}
            AND gm.status='active'
        )
        AND (${activityAlias}.visibility <> 'private' OR ${activityAlias}.actor_id=${actorParameter})
      )
      OR
      ((${activityAlias}.group_id IS NULL OR ${groupAlias}.privacy='public')
        AND (
          ${activityAlias}.actor_id=${actorParameter}
          OR ${activityAlias}.visibility IN ('public','members')
          OR (${activityAlias}.visibility='group'
            AND ${activityAlias}.group_id IS NOT NULL
            AND EXISTS (
              SELECT 1 FROM social_group_memberships gm
              WHERE gm.group_id=${activityAlias}.group_id
                AND gm.user_id=${actorParameter}
                AND gm.status='active'
            )
          )
        )
      )
    )
  )`;
}
/**
 * Return a visibility predicate for a comment and every ancestor in its
 * thread. Each comment must retain the same group and visibility as its
 * parent, and every ancestor must remain visible to the requesting actor.
 * The walk requires a top-level non-comment root; UNION makes the recursion
 * finite and parent cycles fail closed rather than exposing malformed threads.
 */
function communityCommentParentVisibleSql(activityAlias, actorParameter) {
  return `(
    (${activityAlias}.activity_type <> 'comment' AND ${activityAlias}.parent_id IS NULL)
    OR (
      ${activityAlias}.activity_type = 'comment'
      AND ${activityAlias}.parent_id IS NOT NULL
      AND EXISTS (
        WITH RECURSIVE community_comment_parent_chain AS (
          SELECT
            parent.id AS ancestor_id,
            parent.parent_id AS next_parent_id,
            parent.site_id,
            parent.actor_id,
            parent.group_id,
            parent.activity_type,
            parent.visibility,
            (
              ${activityAlias}.group_id IS NOT DISTINCT FROM parent.group_id
              AND ${activityAlias}.visibility = parent.visibility
            ) AS scope_matches
          FROM social_activities parent
          WHERE parent.id = ${activityAlias}.parent_id
            AND parent.site_id = ${activityAlias}.site_id
            AND parent.deleted_at IS NULL

          UNION

          SELECT
            next_parent.id AS ancestor_id,
            next_parent.parent_id AS next_parent_id,
            next_parent.site_id,
            next_parent.actor_id,
            next_parent.group_id,
            next_parent.activity_type,
            next_parent.visibility,
            (
              chain.scope_matches
              AND chain.group_id IS NOT DISTINCT FROM next_parent.group_id
              AND chain.visibility = next_parent.visibility
            ) AS scope_matches
          FROM community_comment_parent_chain chain
          JOIN social_activities next_parent
            ON next_parent.id = chain.next_parent_id
            AND next_parent.site_id = chain.site_id
            AND next_parent.deleted_at IS NULL
          WHERE chain.next_parent_id IS NOT NULL
        )
        SELECT 1
        FROM community_comment_parent_chain chain
        LEFT JOIN social_groups chain_group
          ON chain_group.id = chain.group_id
          AND chain_group.site_id = chain.site_id
        HAVING COUNT(*) > 0
          AND BOOL_OR(chain.next_parent_id IS NULL AND chain.activity_type <> 'comment')
          AND BOOL_AND(
            chain.scope_matches
            AND ${communityActivityVisibilitySql('chain', 'chain_group', actorParameter)}
            AND (
              (
                chain.next_parent_id IS NULL
                AND chain.activity_type <> 'comment'
              )
              OR (
                chain.next_parent_id IS NOT NULL
                AND chain.activity_type = 'comment'
                AND EXISTS (
                  SELECT 1
                  FROM social_activities next_parent
                  WHERE next_parent.id = chain.next_parent_id
                    AND next_parent.site_id = chain.site_id
                    AND next_parent.deleted_at IS NULL
                )
              )
            )
          )
      )
    )
  )`;
}

function presentationValid(value) {
  const errors=[]; if (!isBoundedJsonObject(value, 16_384)) return { valid:false, errors:['presentation must be a small JSON object'] };
  const allowed=new Set(['megaMenu','layout','width','columns','showDescriptions','showImages','showIcons','featuredContentId','mobileMode','trigger']);
  for(const key of Object.keys(value)) if(!allowed.has(key)) errors.push(`presentation.${key} is not permitted`);
  if(value.megaMenu!==undefined&&typeof value.megaMenu!=='boolean') errors.push('megaMenu must be boolean');
  if(value.layout!==undefined&&!['columns','tabs','flyout','grid'].includes(value.layout)) errors.push('layout must be columns, tabs, flyout, or grid');
  if(value.width!==undefined&&!['container','wide','full'].includes(value.width)) errors.push('width must be container, wide, or full');
  if(value.columns!==undefined&&(!Number.isInteger(value.columns)||value.columns<1||value.columns>6)) errors.push('columns must be from 1 to 6');
  for(const key of ['showDescriptions','showImages','showIcons']) if(value[key]!==undefined&&typeof value[key]!=='boolean') errors.push(`${key} must be boolean`);
  if(value.mobileMode!==undefined&&!['accordion','drilldown','collapse'].includes(value.mobileMode)) errors.push('mobileMode is invalid');
  if(value.trigger!==undefined&&!['hover','click','focus'].includes(value.trigger)) errors.push('trigger is invalid');
  if(value.featuredContentId!==undefined&&value.featuredContentId!==null&&!validUuid(value.featuredContentId)) errors.push('featuredContentId must be a UUID');
  return {valid:errors.length===0,errors};
}

/**
 * Persist one site-scoped configuration mutation and its identity audit event
 * on the same PostgreSQL client. Callers must finish provider I/O before
 * entering this transaction so rollback semantics remain local and bounded.
 */
function requireIdentityAudit(identity, fail, message) {
  if (typeof identity?.audit !== 'function') {
    throw fail(503, 'ERR_VIRGOSCORPIO_HUB_AUDIT_UNAVAILABLE', message);
  }
}

function requireCloudConnectionAudit(identity, fail) {
  requireIdentityAudit(
    identity,
    fail,
    'Cloud connection changes require the identity audit service.',
  );
}

async function withIdentityAuditTransaction({
  localPool,
  identity,
  fail,
  unavailableMessage,
  mutate,
  audit,
}) {
  requireIdentityAudit(identity, fail, unavailableMessage);
  return withTransaction(localPool, async queryable => {
    const result = await mutate(queryable);
    await identity.audit(audit(result), { queryable });
    return result;
  });
}

async function withCloudConnectionAudit({ localPool, identity, fail, mutate, audit }) {
  return withIdentityAuditTransaction({
    localPool,
    identity,
    fail,
    unavailableMessage: 'Cloud connection changes require the identity audit service.',
    mutate,
    audit,
  });
}

async function handlePlatformRoute(ctx) {
  const { req,res,url,actor,siteIdFor,requireCapability,readJson,sendJson,fail,requestId,localPool,firewall,env,identity,maxBody } = ctx;
  const communityWorkflowHandled = await handleCommunityWorkflowRoute(ctx);
  if (communityWorkflowHandled) return true;
  const commerceHandled = await handleCommerceRoute({
    req, res, url, actor, siteIdFor, requireCapability, readJson, sendJson, fail,
    requestId, localPool, env, identity, maxBody
  });
  if (commerceHandled) return true;
  const pathName=url.pathname; const method=req.method;
  if (method==='GET' && pathName==='/api/v1/icon-library') return sendJson(res,200,{icons:listIcons(),catalogVersion:1,requestId});
  const iconMatch=pathName.match(/^\/api\/v1\/icon-library\/([A-Za-z][A-Za-z0-9]{0,60})$/);
  if(method==='GET'&&iconMatch){const size=Number(url.searchParams.get('size')||24);const strokeWidth=Number(url.searchParams.get('strokeWidth')||1.8);return sendJson(res,200,{name:iconMatch[1],svg:renderIcon(iconMatch[1],{size,strokeWidth,title:url.searchParams.get('title')||null}),requestId});}
  if(method==='POST'&&pathName==='/api/v1/math/render'){
    const body=await readJson(req,Math.min(maxBody,24_000)); if(body.siteId){const siteId=await siteIdFor({req,url,body,actor});await requireCapability(actor,siteId,'content:edit');}
    const rendered=renderMath(body.formula,{displayMode:body.displayMode===true});return sendJson(res,200,{...rendered,requestId});
  }

  const libraryHandled = await handleLibraryRoute(ctx);
  if (libraryHandled) return true;

  const docVersion=pathName.match(/^\/api\/v1\/sites\/([0-9a-f-]{36})\/content\/([0-9a-f-]{36})\/version$/i);
  if(method==='GET'&&docVersion){if(!localPool)throw fail(503,'ERR_VIRGOSCORPIO_HUB_DATABASE_DISABLED','Document version controls require PostgreSQL.');const siteId=docVersion[1];await siteIdFor({ req, url, body: {}, actor, routeSiteId: siteId });await requireCapability(actor,siteId,'content:read');const row=await localPool.query('SELECT id,site_id,content_type,slug,locale,title,status,schema_version,version,body,published_at,updated_at FROM content_items WHERE site_id=$1 AND id=$2 AND deleted_at IS NULL',[siteId,docVersion[2]]);if(!row.rows[0])throw fail(404,'ERR_VIRGOSCORPIO_HUB_CONTENT_NOT_FOUND','Content was not found.');const revisionCount=await localPool.query('SELECT count(*)::integer AS count,max(version)::integer AS latest_version FROM content_revisions WHERE content_id=$1',[docVersion[2]]);const item=row.rows[0];return sendJson(res,200,{documentId:item.body?.documentId||item.id,contentId:item.id,version:item.version,schemaVersion:item.schema_version,status:item.status,publishedAt:item.published_at,updatedAt:item.updated_at,revisionCount:revisionCount.rows[0].count,latestRevisionVersion:revisionCount.rows[0].latest_version,requestId});}

  const communityProfile=pathName.match(/^\/api\/v1\/sites\/([0-9a-f-]{36})\/community\/profile$/i);
  if(communityProfile&&['GET','PUT'].includes(method)){if(!localPool||!actor.user.id)throw fail(503,'ERR_VIRGOSCORPIO_HUB_COMMUNITY_DISABLED','Community profiles require a signed-in user and PostgreSQL.');const siteId=communityProfile[1];const body=method==='PUT'?await readJson(req,Math.min(maxBody,32_000)):{};await siteIdFor({ req, url, body, actor, routeSiteId: siteId });if(method==='GET'){const q=await localPool.query('SELECT display_name,bio,avatar_asset_id,website_url,visibility,metadata,version,updated_at FROM social_profiles WHERE site_id=$1 AND user_id=$2',[siteId,actor.user.id]);return sendJson(res,200,{profile:q.rows[0]||null,requestId});}const v=validateProfile(body);if(!v.valid)throw fail(422,'ERR_VIRGOSCORPIO_HUB_PROFILE_INVALID','Profile validation failed.',v.errors);const profile=await localPool.query(`INSERT INTO social_profiles(site_id,user_id,display_name,bio,avatar_asset_id,website_url,visibility,metadata) VALUES($1,$2,$3,$4,$5,$6,$7,$8::jsonb) ON CONFLICT(site_id,user_id) DO UPDATE SET display_name=EXCLUDED.display_name,bio=EXCLUDED.bio,avatar_asset_id=EXCLUDED.avatar_asset_id,website_url=EXCLUDED.website_url,visibility=EXCLUDED.visibility,metadata=EXCLUDED.metadata,version=social_profiles.version+1,updated_at=now() WHERE $9::integer IS NULL OR social_profiles.version=$9 RETURNING display_name,bio,avatar_asset_id,website_url,visibility,metadata,version,updated_at`,[siteId,actor.user.id,body.displayName.trim(),body.bio||'',body.avatarAssetId||null,body.websiteUrl||null,body.visibility||'members',JSON.stringify(body.metadata||{}),body.expectedVersion==null?null:Number(body.expectedVersion)]);if(!profile.rows[0])throw fail(409,'ERR_VIRGOSCORPIO_HUB_VERSION_CONFLICT','Profile version is stale.');return sendJson(res,200,{profile:profile.rows[0],requestId});}
  const groups=pathName.match(/^\/api\/v1\/sites\/([0-9a-f-]{36})\/community\/groups(?:\/([0-9a-f-]{36})\/(join|members))?$/i);
  if (
    groups && (
      (!groups[2] && ['GET', 'POST'].includes(method)) ||
      (groups[2] && groups[3] === 'join' && method === 'POST') ||
      (groups[2] && groups[3] === 'members' && method === 'GET')
    )
  ) {if(!localPool||!actor.user.id)throw fail(503,'ERR_VIRGOSCORPIO_HUB_COMMUNITY_DISABLED','Community groups require PostgreSQL and a signed-in user.');const siteId=groups[1],body=method==='POST'?await readJson(req,Math.min(maxBody,32_000)):{};await siteIdFor({ req, url, body, actor, routeSiteId: siteId });
    if(!groups[2]&&method==='GET'){const q=await localPool.query(`SELECT g.id,g.slug,g.name,g.description,g.privacy,g.created_by,g.created_at,(SELECT count(*)::int FROM social_group_memberships gm WHERE gm.group_id=g.id AND gm.status='active') member_count,(SELECT status FROM social_group_memberships gm WHERE gm.group_id=g.id AND gm.user_id=$2) my_status FROM social_groups g WHERE g.site_id=$1 AND (g.privacy='public' OR g.created_by=$2 OR EXISTS(SELECT 1 FROM social_group_memberships gm WHERE gm.group_id=g.id AND gm.user_id=$2 AND gm.status='active')) ORDER BY g.created_at DESC LIMIT 200`,[siteId,actor.user.id]);return sendJson(res,200,{groups:q.rows,requestId});}
    if(!groups[2]&&method==='POST'){await requireCapability(actor,siteId,'content:create');const v=validateGroup(body);if(!v.valid)throw fail(422,'ERR_VIRGOSCORPIO_HUB_GROUP_INVALID','Group validation failed.',v.errors);const client=await localPool.connect();try{await client.query('BEGIN');const q=await client.query('INSERT INTO social_groups(site_id,slug,name,description,privacy,created_by) VALUES($1,$2,$3,$4,$5,$6) RETURNING *',[siteId,body.slug,body.name.trim(),body.description||'',body.privacy||'public',actor.user.id]);await client.query("INSERT INTO social_group_memberships(group_id,user_id,role,status) VALUES($1,$2,'owner','active')",[q.rows[0].id,actor.user.id]);await client.query('COMMIT');return sendJson(res,201,{group:q.rows[0],requestId});}catch(e){await client.query('ROLLBACK').catch(()=>{});throw e;}finally{client.release();}}
    if(groups[3]==='join'){const g=await localPool.query('SELECT id,privacy FROM social_groups WHERE site_id=$1 AND id=$2',[siteId,groups[2]]);if(!g.rows[0])throw fail(404,'ERR_VIRGOSCORPIO_HUB_GROUP_NOT_FOUND','Group not found.');const status=g.rows[0].privacy==='public'?'active':'pending';const q=await localPool.query('INSERT INTO social_group_memberships(group_id,user_id,role,status) VALUES($1,$2,\'member\',$3) ON CONFLICT(group_id,user_id) DO UPDATE SET status=CASE WHEN social_group_memberships.status=\'banned\' THEN \'banned\' ELSE EXCLUDED.status END RETURNING group_id,user_id,role,status,created_at',[groups[2],actor.user.id,status]);if(q.rows[0].status==='banned')throw fail(403,'ERR_VIRGOSCORPIO_HUB_GROUP_BANNED','You cannot rejoin this group.');return sendJson(res,200,{membership:q.rows[0],requestId});}
    if(groups[3]==='members'){await requireCapability(actor,siteId,'community:moderate');const q=await localPool.query('SELECT u.id,u.display_name,u.email,gm.role,gm.status,gm.created_at FROM social_group_memberships gm JOIN users u ON u.id=gm.user_id JOIN social_groups g ON g.id=gm.group_id WHERE g.site_id=$1 AND g.id=$2 ORDER BY gm.created_at',[siteId,groups[2]]);return sendJson(res,200,{members:q.rows,requestId});}
  }
  const feed=pathName.match(/^\/api\/v1\/sites\/([0-9a-f-]{36})\/community\/feed$/i);
  if (feed && ['GET', 'POST'].includes(method)) {
    if (!localPool || !actor.user.id) {
      throw fail(503, 'ERR_VIRGOSCORPIO_HUB_COMMUNITY_DISABLED', 'Community feed requires PostgreSQL and a signed-in user.');
    }
    const siteId = feed[1];
    const body = method === 'POST' ? await readJson(req, Math.min(maxBody, 32_000)) : {};
    await siteIdFor({ req, url, body, actor, routeSiteId: siteId });

    if (method === 'GET') {
      const q = await localPool.query(
        "SELECT a.id,a.actor_id,u.display_name,a.group_id,a.activity_type,a.body,a.visibility,a.parent_id,a.metadata,a.created_at " +
        "FROM social_activities a JOIN users u ON u.id=a.actor_id " +
        "LEFT JOIN social_groups g ON g.id=a.group_id AND g.site_id=a.site_id " +
        "WHERE a.site_id=$1 AND a.deleted_at IS NULL AND " +
        communityActivityVisibilitySql('a', 'g', '$2') +
        " AND " + communityCommentParentVisibleSql('a', '$2') + " " +
        "ORDER BY a.created_at DESC LIMIT $3",
        [siteId, actor.user.id, Math.min(100, Math.max(1, Number(url.searchParams.get('limit')) || 30))]
      );
      return sendJson(res, 200, { activities: q.rows, requestId });
    }

    const text = cleanText(body.body, 10000);
    if (!text) {
      throw fail(400, 'ERR_VIRGOSCORPIO_HUB_ACTIVITY_INVALID', 'Activity body must contain 1-10000 characters.');
    }

    const activityType = body.activityType === 'comment'
      ? 'comment'
      : body.groupId
        ? 'group_post'
        : 'status';
    const requestedVisibility = body.visibility || 'members';
    if (!['public', 'members', 'private', 'group'].includes(requestedVisibility)) {
      throw fail(400, 'ERR_VIRGOSCORPIO_HUB_ACTIVITY_INVALID', 'Activity visibility is invalid.');
    }

    let groupId = null;
    let parentId = null;
    let visibility = requestedVisibility;

    if (activityType === 'comment') {
      if (!validUuid(body.parentId)) {
        throw fail(400, 'ERR_VIRGOSCORPIO_HUB_ACTIVITY_PARENT_REQUIRED', 'A valid parent activity is required for comments.');
      }

      const parentResult = await localPool.query(
        "SELECT a.id,a.group_id,a.visibility,g.privacy " +
        "FROM social_activities a LEFT JOIN social_groups g ON g.id=a.group_id AND g.site_id=a.site_id " +
        "WHERE a.site_id=$1 AND a.id=$2 AND a.deleted_at IS NULL AND " +
        communityActivityVisibilitySql('a', 'g', '$3') +
        " AND " + communityCommentParentVisibleSql('a', '$3') +
        " LIMIT 1",
        [siteId, body.parentId, actor.user.id]
      );
      const parent = parentResult.rows[0];
      if (!parent) {
        throw fail(404, 'ERR_VIRGOSCORPIO_HUB_ACTIVITY_NOT_FOUND', 'Activity not found.');
      }
      if (body.groupId != null && body.groupId !== parent.group_id) {
        throw fail(400, 'ERR_VIRGOSCORPIO_HUB_ACTIVITY_PARENT_SCOPE_MISMATCH', 'A comment must remain in its parent activity scope.');
      }

      parentId = parent.id;
      groupId = parent.group_id;
      visibility = parent.visibility;
    } else {
      if (body.parentId != null) {
        throw fail(400, 'ERR_VIRGOSCORPIO_HUB_ACTIVITY_PARENT_INVALID', 'Only comments may reference a parent activity.');
      }

      if (body.groupId != null) {
        if (!validUuid(body.groupId)) {
          throw fail(400, 'ERR_VIRGOSCORPIO_HUB_ACTIVITY_GROUP_INVALID', 'A valid group is required.');
        }
        const membership = await localPool.query(
          "SELECT g.id,g.privacy FROM social_groups g " +
          "JOIN social_group_memberships gm ON gm.group_id=g.id " +
          "WHERE g.site_id=$1 AND g.id=$2 AND gm.user_id=$3 AND gm.status='active' LIMIT 1",
          [siteId, body.groupId, actor.user.id]
        );
        if (!membership.rows[0]) {
          throw fail(403, 'ERR_VIRGOSCORPIO_HUB_GROUP_MEMBERSHIP', 'Active group membership is required to post in this group.');
        }
        groupId = membership.rows[0].id;
        if (membership.rows[0].privacy !== 'public' && visibility !== 'private') {
          visibility = 'group';
        }
      } else if (visibility === 'group') {
        throw fail(400, 'ERR_VIRGOSCORPIO_HUB_ACTIVITY_GROUP_REQUIRED', 'A group is required for group visibility.');
      }
    }

    const q = await localPool.query(
      "INSERT INTO social_activities " +
      "(site_id,actor_id,group_id,activity_type,body,visibility,parent_id,metadata) " +
      "VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb) " +
      "RETURNING id,site_id,actor_id,group_id,activity_type,body,visibility,parent_id,metadata,created_at",
      [siteId, actor.user.id, groupId, activityType, text, visibility, parentId, JSON.stringify({})]
    );
    return sendJson(res, 201, { activity: q.rows[0], requestId });
  }

  const friendRequest=pathName.match(/^\/api\/v1\/sites\/([0-9a-f-]{36})\/community\/friends(?:\/([0-9a-f-]{36}))?$/i);
  if(friendRequest&&['GET','POST','PUT','DELETE'].includes(method)){if(!localPool||!actor.user.id)throw fail(503,'ERR_VIRGOSCORPIO_HUB_COMMUNITY_DISABLED','Friendships require PostgreSQL and a signed-in user.');const siteId=friendRequest[1],target=friendRequest[2];await siteIdFor({ req, url, body: {}, actor, routeSiteId: siteId });if(method==='GET'){const q=await localPool.query(`SELECT f.requester_id,f.addressee_id,f.status,f.created_at,u1.display_name AS requester_name,u2.display_name AS addressee_name FROM social_friendships f JOIN users u1 ON u1.id=f.requester_id JOIN users u2 ON u2.id=f.addressee_id WHERE f.site_id=$1 AND (f.requester_id=$2 OR f.addressee_id=$2) ORDER BY f.created_at DESC LIMIT 200`,[siteId,actor.user.id]);return sendJson(res,200,{friendships:q.rows,requestId});}if(!target||!validUuid(target)||target===actor.user.id)throw fail(400,'ERR_VIRGOSCORPIO_HUB_FRIEND_INVALID','A different valid user ID is required.');if(method==='POST'){const member=await localPool.query('SELECT 1 FROM site_memberships sm JOIN users u ON u.id=sm.user_id WHERE sm.site_id=$1 AND sm.user_id=$2 AND u.status=$3 LIMIT 1',[siteId,target,'active']);if(!member.rows[0])throw fail(404,'ERR_VIRGOSCORPIO_HUB_COMMUNITY_USER_NOT_FOUND','User is not a member of this site.');const q=await localPool.query("INSERT INTO social_friendships(site_id,requester_id,addressee_id,status) VALUES($1,$2,$3,'pending') ON CONFLICT(site_id,requester_id,addressee_id) DO UPDATE SET status=CASE WHEN social_friendships.status='blocked' THEN 'blocked' ELSE social_friendships.status END,updated_at=now() RETURNING *",[siteId,actor.user.id,target]);return sendJson(res,201,{friendship:q.rows[0],requestId});}if(method==='PUT'){const q=await localPool.query("UPDATE social_friendships SET status='accepted',updated_at=now() WHERE site_id=$1 AND requester_id=$2 AND addressee_id=$3 AND status='pending' RETURNING *",[siteId,target,actor.user.id]);if(!q.rows[0])throw fail(404,'ERR_VIRGOSCORPIO_HUB_FRIEND_REQUEST_NOT_FOUND','Pending friend request not found.');return sendJson(res,200,{friendship:q.rows[0],requestId});}const q=await localPool.query('DELETE FROM social_friendships WHERE site_id=$1 AND ((requester_id=$2 AND addressee_id=$3) OR (requester_id=$3 AND addressee_id=$2)) RETURNING site_id',[siteId,actor.user.id,target]);return sendJson(res,200,{removed:Boolean(q.rowCount),requestId});}

  const firewallCollection=pathName.match(/^\/api\/v1\/sites\/([0-9a-f-]{36})\/security\/firewall-rules$/i);
  const firewallItem=pathName.match(/^\/api\/v1\/sites\/([0-9a-f-]{36})\/security\/firewall-rules\/([0-9a-f-]{36})$/i);
  if ((firewallCollection && ['GET','POST'].includes(method)) || (firewallItem && method === 'DELETE')) {
    if (!localPool || !firewall) throw fail(503, 'ERR_VIRGOSCORPIO_HUB_FIREWALL_DISABLED', 'Firewall rule management requires PostgreSQL.');
    const siteId = firewallCollection?.[1] || firewallItem[1];
    const body = method === 'POST' ? await readJson(req, Math.min(maxBody, 32_000)) : {};
    await siteIdFor({ req, url, body, actor, routeSiteId: siteId });
    await requireCapability(actor, siteId, 'security:manage');

    if (method === 'GET') {
      const q = await localPool.query(
        'SELECT id,site_id,action,scope,pattern,reason,enabled,created_by,created_at,updated_at FROM firewall_rules WHERE site_id=$1 OR site_id IS NULL ORDER BY created_at DESC LIMIT 500',
        [siteId]
      );
      return sendJson(res, 200, { rules: q.rows, requestId });
    }

    if (method === 'POST') {
      if (!['allow','deny','challenge','rate_limit'].includes(body.action) ||
          !['ip','cidr','path','user_agent'].includes(body.scope) ||
          !validateIpPattern(body.scope, body.pattern) ||
          typeof body.reason !== 'string' || body.reason.length > 500) {
        throw fail(422, 'ERR_VIRGOSCORPIO_HUB_FIREWALL_RULE_INVALID', 'Firewall rule action, scope, pattern, or reason is invalid.');
      }

      const rule = await withTransaction(localPool, async client => {
        const q = await client.query(
          'INSERT INTO firewall_rules(site_id,action,scope,pattern,reason,enabled,created_by) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id,site_id,action,scope,pattern,reason,enabled,created_by,created_at,updated_at',
          [siteId, body.action, body.scope, body.pattern, body.reason, body.enabled !== false, actor.user.id || null]
        );
        await client.query(
          'INSERT INTO site_security_events(site_id,request_id,event_type,severity,actor_id,details) VALUES($1,$2,$3,$4,$5,$6::jsonb)',
          [siteId, requestId, 'firewall.rule_created', 'medium', actor.user.id || null, JSON.stringify({ ruleId: q.rows[0].id, action: body.action, scope: body.scope })]
        );
        return q.rows[0];
      });
      firewall.clearCache();
      return sendJson(res, 201, { rule, requestId });
    }

    await withTransaction(localPool, async client => {
      const q = await client.query(
        'DELETE FROM firewall_rules WHERE site_id=$1 AND id=$2 RETURNING id,action,scope',
        [siteId, firewallItem[2]]
      );
      if (!q.rows[0]) throw fail(404, 'ERR_VIRGOSCORPIO_HUB_FIREWALL_RULE_NOT_FOUND', 'Firewall rule not found.');
      await client.query(
        'INSERT INTO site_security_events(site_id,request_id,event_type,severity,actor_id,details) VALUES($1,$2,$3,$4,$5,$6::jsonb)',
        [siteId, requestId, 'firewall.rule_deleted', 'medium', actor.user.id || null, JSON.stringify({ ruleId: q.rows[0].id, action: q.rows[0].action, scope: q.rows[0].scope })]
      );
    });
    firewall.clearCache();
    return sendJson(res, 200, { deleted: true, requestId });
  }

  const cloudConnections = pathName.match(
    /^\/api\/v1\/sites\/([0-9a-f-]{36})\/cloud\/connections(?:\/([0-9a-f-]{36})\/(test|disable))?$/i,
  );
  if (
    cloudConnections &&
    ((!cloudConnections[2] && ['GET', 'POST'].includes(method)) ||
      (cloudConnections[2] && method === 'POST'))
  ) {
    if (!localPool) throw fail(503, 'ERR_VIRGOSCORPIO_HUB_DATABASE_DISABLED', 'Cloud integration settings require PostgreSQL.');

    const siteId = cloudConnections[1];
    const body = method === 'POST' ? await readJson(req, Math.min(maxBody, 32_000)) : {};
    await siteIdFor({ req, url, body, actor, routeSiteId: siteId });
    await requireCapability(actor, siteId, 'cloud:manage');

    // Fail before provider I/O or a cloud write if the audit service is absent.
    if (method === 'POST') requireCloudConnectionAudit(identity, fail);

    if (!cloudConnections[2] && method === 'GET') {
      const q = await localPool.query(
        'SELECT id,site_id,provider,name,config,credential_reference,status,last_health_check_at,created_at,updated_at FROM cloud_connections WHERE site_id=$1 ORDER BY created_at DESC',
        [siteId],
      );
      return sendJson(res, 200, {
        connections: q.rows,
        availableProviders: ['aws-s3', 's3-compatible', 'google-cloud-storage', 'azure-blob', 'cloudflare-r2', 'minio'],
        requestId,
      });
    }

    if (!cloudConnections[2] && method === 'POST') {
      const validation = cloudConfigStatus({
        provider: body.provider,
        credentialReference: body.credentialReference,
        config: body.config || {},
      });
      const endpointAllowed = !(body.config || {}).endpoint || cloudEndpointAllowed((body.config || {}).endpoint, env);
      if (!validation.valid || !endpointAllowed) {
        throw fail(422, 'ERR_VIRGOSCORPIO_HUB_CLOUD_CONFIG_INVALID', 'Cloud connection failed validation.', [
          ...validation.errors,
          ...(!endpointAllowed ? ['endpoint must match the deployment allowlist in production'] : []),
        ]);
      }
      if (typeof body.name !== 'string' || !body.name.trim() || body.name.length > 180) {
        throw fail(400, 'ERR_VIRGOSCORPIO_HUB_CLOUD_CONFIG_INVALID', 'Connection name is required.');
      }

      const connection = await withCloudConnectionAudit({
        localPool,
        identity,
        fail,
        mutate: async queryable => {
          const q = await queryable.query(
            "INSERT INTO cloud_connections(site_id,provider,name,config,credential_reference,status) VALUES($1,$2,$3,$4::jsonb,$5,'configured') RETURNING id,site_id,provider,name,config,credential_reference,status,created_at,updated_at",
            [siteId, body.provider, body.name.trim(), JSON.stringify(body.config || {}), body.credentialReference],
          );
          return q.rows[0];
        },
        audit: saved => ({
          siteId,
          actorId: actor?.user?.id || null,
          action: 'cloud.connection_created',
          targetType: 'cloud-connection',
          targetId: saved.id,
          requestId,
          details: { provider: saved.provider, status: saved.status },
        }),
      });

      return sendJson(res, 201, {
        connection,
        note: 'Credentials are held by the configured secret manager; this record does not store secret values.',
        requestId,
      });
    }

    const connectionId = cloudConnections[2];
    const action = cloudConnections[3];

    if (action === 'disable') {
      const connection = await withCloudConnectionAudit({
        localPool,
        identity,
        fail,
        mutate: async queryable => {
          const q = await queryable.query(
            "UPDATE cloud_connections SET status='disabled',updated_at=now() WHERE site_id=$1 AND id=$2 RETURNING id,provider,status",
            [siteId, connectionId],
          );
          if (!q.rows[0]) {
            throw fail(404, 'ERR_VIRGOSCORPIO_HUB_CLOUD_CONNECTION_NOT_FOUND', 'Cloud connection not found.');
          }
          return q.rows[0];
        },
        audit: saved => ({
          siteId,
          actorId: actor?.user?.id || null,
          action: 'cloud.connection_disabled',
          targetType: 'cloud-connection',
          targetId: saved.id,
          requestId,
          details: { provider: saved.provider, status: saved.status },
        }),
      });

      // Preserve the established response contract (id and status only).
      return sendJson(res, 200, {
        connection: { id: connection.id, status: connection.status },
        requestId,
      });
    }

    if (action === 'test') {
      const q = await localPool.query(
        'SELECT id,provider,config,credential_reference,status FROM cloud_connections WHERE site_id=$1 AND id=$2',
        [siteId, connectionId],
      );
      if (!q.rows[0]) {
        throw fail(404, 'ERR_VIRGOSCORPIO_HUB_CLOUD_CONNECTION_NOT_FOUND', 'Cloud connection not found.');
      }

      const connection = q.rows[0];
      const credentialStatus = resolveCloudCredentialReference({
        provider: connection.provider,
        reference: connection.credential_reference,
        env,
      });
      const configured = credentialStatus.ok;
      let result = {
        status: 'unhealthy',
        provider: connection.provider,
        credentialReferenceConfigured: configured,
        credentialReferenceMode: credentialStatus.mode || 'unsupported',
        liveProbeAttempted: false,
        liveObjectStoreOperationPerformed: false,
      };

      if (configured) {
        try {
          const config = connection.config || {};
          const providerMap = {
            'aws-s3': 'aws-s3',
            's3-compatible': 's3-compatible',
            'cloudflare-r2': 'cloudflare-r2',
            minio: 'minio',
            'google-cloud-storage': 'google-cloud-storage',
            'azure-blob': 'azure-blob',
          };
          const expected = providerMap[connection.provider];
          if (!expected) throw new Error('unsupported provider');

          const bucket = config.bucket || env.LIBRARY_STORAGE_BUCKET || env.S3_BUCKET || env.GCS_BUCKET;
          const container = config.container || env.LIBRARY_STORAGE_CONTAINER || env.AZURE_STORAGE_CONTAINER;
          if (
            ['aws-s3', 's3-compatible', 'cloudflare-r2', 'minio', 'google-cloud-storage'].includes(expected) &&
            (!bucket || typeof bucket !== 'string')
          ) {
            throw new Error('bucket is not configured');
          }
          if (expected === 'azure-blob' && (!container || typeof container !== 'string')) {
            throw new Error('container is not configured');
          }

          const probeEnv = {
            ...env,
            LIBRARY_STORAGE_PROVIDER: expected,
            LIBRARY_STORAGE_BUCKET: bucket,
            LIBRARY_STORAGE_CONTAINER: container,
            LIBRARY_STORAGE_ENDPOINT: config.endpoint || env.LIBRARY_STORAGE_ENDPOINT,
            LIBRARY_STORAGE_REGION: config.region || env.LIBRARY_STORAGE_REGION,
            S3_FORCE_PATH_STYLE: config.forcePathStyle === true
              ? 'true'
              : (config.forcePathStyle === false ? 'false' : env.S3_FORCE_PATH_STYLE),
            GOOGLE_CLOUD_PROJECT: config.projectId || env.GOOGLE_CLOUD_PROJECT,
          };
          const adapter = createCloudStorageAdapterFromEnv({ env: probeEnv });
          result = { ...result, liveProbeAttempted: Boolean(adapter) };
          const probe = await probeCloudStorageAdapter(adapter);
          result = {
            status: 'healthy',
            provider: connection.provider,
            credentialReferenceConfigured: true,
            credentialReferenceMode: credentialStatus.mode,
            liveProbeAttempted: true,
            liveObjectStoreOperationPerformed: true,
            probe,
          };
        } catch (error) {
          result = {
            ...result,
            status: 'unhealthy',
            errorCode: error.code || 'ERR_VIRGOSCORPIO_HUB_CLOUD_PROBE_FAILED',
            message: 'Live storage probe failed. Verify provider credentials, bucket/container configuration, and permissions.',
          };
        }
      } else {
        result = {
          ...result,
          status: 'unhealthy',
          message: credentialStatus.message || 'Credential reference could not be resolved by this runtime.',
        };
      }

      // Provider I/O is complete. Persist only its safe outcome and audit
      // metadata in a short transaction; never hold a DB client during the probe.
      await withCloudConnectionAudit({
        localPool,
        identity,
        fail,
        mutate: async queryable => {
          const updated = await queryable.query(
            "UPDATE cloud_connections SET status=CASE WHEN status='disabled' THEN 'disabled' ELSE $3 END,last_health_check_at=now(),updated_at=now() WHERE site_id=$1 AND id=$2 RETURNING id,provider,status",
            [siteId, connectionId, result.status],
          );
          if (!updated.rows[0]) {
            throw fail(404, 'ERR_VIRGOSCORPIO_HUB_CLOUD_CONNECTION_NOT_FOUND', 'Cloud connection not found.');
          }
          return updated.rows[0];
        },
        audit: saved => ({
          siteId,
          actorId: actor?.user?.id || null,
          action: 'cloud.connection_tested',
          targetType: 'cloud-connection',
          targetId: saved.id,
          requestId,
          details: {
            provider: saved.provider,
            probeStatus: result.status,
            connectionStatus: saved.status,
            credentialReferenceMode: String(result.credentialReferenceMode || 'unsupported'),
            liveProbeAttempted: result.liveProbeAttempted === true,
            liveObjectStoreOperationPerformed: result.liveObjectStoreOperationPerformed === true,
          },
        }),
      });

      return sendJson(res, 200, { test: result, requestId });
    }
  }

  const megaMenus = pathName.match(/^\/api\/v1\/sites\/([0-9a-f-]{36})\/mega-menus(?:\/([a-z0-9][a-z0-9-]{0,100}))?$/i);
  if (
    megaMenus &&
    ((!megaMenus[2] && ['GET', 'POST'].includes(method)) ||
      (megaMenus[2] && ['PUT', 'DELETE'].includes(method)))
  ) {
    if (!localPool) {
      throw fail(503, 'ERR_VIRGOSCORPIO_HUB_DATABASE_DISABLED', 'Mega menus require PostgreSQL.');
    }
    const siteId = megaMenus[1];
    const body = ['POST', 'PUT'].includes(method)
      ? await readJson(req, Math.min(maxBody, 256_000))
      : {};
    await siteIdFor({ req, url, body, actor, routeSiteId: siteId });
    await requireCapability(actor, siteId, method === 'GET' ? 'content:read' : 'site:manage');

    if (!megaMenus[2] && method === 'GET') {
      const result = await localPool.query(
        "SELECT id,slug,name,version,items,presentation,created_at,updated_at FROM navigation_menus WHERE site_id=$1 AND presentation->>'megaMenu'='true' ORDER BY name",
        [siteId],
      );
      return sendJson(res, 200, { menus: result.rows, requestId });
    }

    const isCreate = !megaMenus[2] && method === 'POST';
    if (isCreate || (megaMenus[2] && method === 'PUT')) {
      const slug = String(body.slug || megaMenus[2] || '');
      if (!/^[a-z0-9][a-z0-9-]{0,100}$/.test(slug) ||
          typeof body.name !== 'string' || !body.name.trim() || body.name.length > 180) {
        throw fail(400, 'ERR_VIRGOSCORPIO_HUB_MEGA_MENU_METADATA', 'Mega menu slug and name are required.');
      }
      const validItems = validateMenuItems(body.items || []);
      if (!validItems.valid) {
        throw fail(422, 'ERR_VIRGOSCORPIO_HUB_MENU_INVALID', 'Mega-menu items failed validation.', validItems.errors);
      }
      const presentation = {
        megaMenu: true,
        layout: 'columns',
        width: 'wide',
        columns: 3,
        showDescriptions: false,
        showImages: false,
        showIcons: true,
        mobileMode: 'accordion',
        trigger: 'click',
        ...(body.presentation || {}),
      };
      const validatedPresentation = presentationValid(presentation);
      if (!validatedPresentation.valid) {
        throw fail(422, 'ERR_VIRGOSCORPIO_HUB_MEGA_MENU_PRESENTATION', 'Mega-menu presentation failed validation.', validatedPresentation.errors);
      }

      const menu = await withIdentityAuditTransaction({
        localPool,
        identity,
        fail,
        unavailableMessage: 'Mega-menu changes require the identity audit service.',
        mutate: async queryable => {
          const result = isCreate
            ? await queryable.query(
              'INSERT INTO navigation_menus(site_id,slug,name,items,presentation,updated_by) VALUES($1,$2,$3,$4::jsonb,$5::jsonb,$6) RETURNING id,slug,name,version,items,presentation,created_at,updated_at',
              [siteId, slug, body.name.trim(), JSON.stringify(body.items || []), JSON.stringify(presentation), actor.user.id || null],
            )
            : await queryable.query(
              'UPDATE navigation_menus SET name=$3,items=$4::jsonb,presentation=$5::jsonb,version=version+1,updated_by=$6,updated_at=now() WHERE site_id=$1 AND slug=$2 AND version=$7 RETURNING id,slug,name,version,items,presentation,created_at,updated_at',
              [siteId, megaMenus[2], body.name.trim(), JSON.stringify(body.items || []), JSON.stringify(presentation), actor.user.id || null, Number(body.expectedVersion)],
            );
          if (!result.rows[0]) {
            throw fail(409, 'ERR_VIRGOSCORPIO_HUB_VERSION_CONFLICT', 'Mega menu is missing or stale.');
          }
          return result.rows[0];
        },
        audit: saved => ({
          siteId,
          actorId: actor.user.id,
          action: isCreate ? 'navigation.mega_menu_created' : 'navigation.mega_menu_updated',
          targetType: 'navigation-menu',
          targetId: saved.id,
          requestId,
          details: { slug: saved.slug, version: saved.version },
        }),
      });
      return sendJson(res, isCreate ? 201 : 200, { menu, requestId });
    }

    await withIdentityAuditTransaction({
      localPool,
      identity,
      fail,
      unavailableMessage: 'Mega-menu changes require the identity audit service.',
      mutate: async queryable => {
        const result = await queryable.query(
          "DELETE FROM navigation_menus WHERE site_id=$1 AND slug=$2 AND presentation->>'megaMenu'='true' RETURNING id,slug,version",
          [siteId, megaMenus[2]],
        );
        if (!result.rows[0]) {
          throw fail(404, 'ERR_VIRGOSCORPIO_HUB_MEGA_MENU_NOT_FOUND', 'Mega menu not found.');
        }
        return result.rows[0];
      },
      audit: removed => ({
        siteId,
        actorId: actor.user.id,
        action: 'navigation.mega_menu_deleted',
        targetType: 'navigation-menu',
        targetId: removed.id,
        requestId,
        details: { slug: removed.slug, version: removed.version },
      }),
    });
    return sendJson(res, 200, { deleted: true, requestId });
  }

  return false;
}
module.exports = { handlePlatformRoute, presentationValid, productInput, validUuid, withIdentityAuditTransaction };
