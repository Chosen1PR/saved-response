import {
  context,
  reddit,
  settings,
  RemovalReason,
  Post,
  Comment
} from "@devvit/web/server";

import {
  PostId,
  CommentId,
  PostOrCommentId
} from "./types";

import {
  deleteCachedModData,
  getCachedTargetId
} from "./redis";

// Helper function to get prefix that goes before Saved Response in PM.
async function getPmPrefix() {
  //const id = context.commentId ?? context.postId!;
  const id = await getCachedTargetId(context.username!);
  let prefix = 'In response to ';
  if (id.startsWith('t1_')) {
    const originalComment = await reddit.getCommentById(id as CommentId);
    const originalPermalink = originalComment.permalink;
    prefix += `[your comment](${originalPermalink}):\n\n---\n\n`;
  }
  else if (id.startsWith('t3_')) {
    const originalPost = await reddit.getPostById(id as PostId);
    const originalPermalink = originalPost.permalink;
    prefix += `[your post](${originalPermalink}):\n\n---\n\n`;
  }
  return prefix;
}

// Helper function to get username of original author of comment or post.
export async function getAuthorsUsername() {
  //const id = context.commentId ?? context.postId!;
  const id = await getCachedTargetId(context.username!);
  let username = '';
  // Determine if the current context is a comment or post and return the author name accordingly
  if (id.startsWith('t1_')) {
    const originalComment = await reddit.getCommentById(id as CommentId);
    username = originalComment.authorName!;
  }
  // If the ID starts with 't3_', it's a post, so return the author name from the post
  else if (id.startsWith('t3_')) {
    const originalPost = await reddit.getPostById(id as PostId);
    username = originalPost.authorName!;
  }
  return username;
}

// Helper function that handles the PM to user.
export async function pmUser(
  username: string,
  savedResponse: string,
  pmAsSubreddit: boolean
) {
  const subredditName = context.subredditName!;
  const subjectText = `A message from r/${subredditName}`;
  const prefix = await getPmPrefix();
  let messageText = prefix + savedResponse;
  if (pmAsSubreddit) {
    const newConvo = await reddit.modMail.createConversation({
      subject: subjectText,
      body: messageText,
      isAuthorHidden: true,
      to: username,
      subredditName: subredditName
    });
    const convoId = newConvo.conversation.id!;
    // Archive the modmail conversation if PMing as subreddit
    await reddit.modMail.reply({
      body: `Originally sent by u/${context.username!}.`,
      isAuthorHidden: false,
      isInternal: true,
      conversationId: convoId
    });
    await deleteCachedModData(context.username!);
    try { await reddit.modMail.archiveConversation(convoId); }
    catch {} // Catch needed in case modmail is sent to a mod, since mod discussions can't be archived.
  }
  else { // PM by bot account, NOT modmail
    messageText += `\n\n---\n\n*This inbox is not monitored. If you have any questions, please message the moderators of r/${subredditName}.*`;
    await reddit.sendPrivateMessage({
      subject: subjectText,
      text: messageText,
      to: username,
    });
    //const id = context.commentId ?? context.postId!;
    await addModNoteForPm(username);
    await deleteCachedModData(context.username!);
  }
}

// Helper function to add a mod note to the app account when a saved response is left as comment (and who left it)
export async function addModNote(id: string) {
  const noteText = `Saved Response left by u/${context.username!}.`;
  await reddit.addModNote({
    subreddit: context.subredditName!,
    user: context.appSlug,
    note: noteText,
    redditId: id as PostOrCommentId,
  });
}

// Helper function to add a mod note to the app account when a saved response is sent as PM (and who sent it)
async function addModNoteForPm(username: string) {
  const noteText = `PM sent to u/${username} by u/${context.username!}.`;
  //const id = context.commentId ?? context.postId!;
  const id = await getCachedTargetId(context.username!);
  await reddit.addModNote({
    subreddit: context.subredditName!,
    user: context.appSlug,
    note: noteText,
    redditId: id as PostOrCommentId,
  });
}

// Helper function to get pre-filtered list of Removal Reasons
export async function getFilteredRemovalReasons() {
  const unfilteredReasons = await reddit.getSubredditRemovalReasons(context.subredditName!);
  const keywordList = (await settings.get("title-keywords")) as string;
  if (keywordList == undefined || keywordList.trim() == "")
    return unfilteredReasons;
  const keywords = keywordList.trim().split(',');
  let filteredReasons: RemovalReason[] = [];
  for (const unfilteredReason of unfilteredReasons) {
    for (let keyword of keywords) {
      keyword = keyword.trim();
      if (keyword != '' && unfilteredReason.title.includes(keyword)) {
        filteredReasons.push(unfilteredReason);
        break;
      }
    }
  }
  return filteredReasons;
}

// Helper function for determining if comment author is a moderator
export async function isUserMod(username: string) {
  if (username == undefined || username == "")
    return false;
  const subredditName = context.subredditName!;
  if (username == "AutoModerator" || username == (subredditName + "-ModTeam"))
    return true;
  // Base conditions satisfied. Get user object.
  const user = await reddit.getUserByUsername(username);
  if (!user) return false; // If user not found, return false.
  const modPermissions = await user.getModPermissionsForSubreddit(subredditName);
  if (!modPermissions) return false; // For no permissions object, return false.
  else if (modPermissions.length < 1) return false; // For no permissions in the object, return false.
  else return true; // Otherwise, it's a mod; return true.
}

// Helper function to get a post or comment object based on its ID.
export async function getPostOrComment(id: string): Promise<Post | Comment | undefined> {
  if (id.startsWith('t3_'))
    return await reddit.getPostById(id as PostId);
  else if (id.startsWith('t1_'))
    return await reddit.getCommentById(id as CommentId);
  else return;
}

// Helper function to get the specific fields of an event.
// Returns empty string if value is not found.
export function getRequestBodyValue(event: any, ...paths: Array<string[]>) {
  for (const path of paths) {
    let current: any = event;
    let found = true;
    for (const key of path) {
      if (current == null || typeof current !== 'object' || !(key in current)) {
        found = false;
        break;
      }
      current = current[key];
    }
    if (found && current != null && current !== '') {
      return String(current);
    }
  }
  return '';
}

// Boolean variant of helper function to get the specific fields of an event.
// Returns false if value is not found.
export function getRequestBodyValueAsBoolean(event: any, ...paths: Array<string[]>) {
  for (const path of paths) {
    let current: any = event;
    let found = true;
    for (const key of path) {
      if (current == null || typeof current !== 'object' || !(key in current)) {
        found = false;
        break;
      }
      current = current[key];
    }
    if (found && current != null && current !== '') {
      return Boolean(current);
    }
  }
  return false;
}