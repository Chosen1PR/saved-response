import {
  Devvit,
  RemovalReason,
} from "@devvit/public-api";

import { PostOrCommentId } from "./types.js";

// Helper function to get prefix that goes before Saved Response in PM.
async function getPmPrefix(context: Devvit.Context) {
  const id = context.commentId ?? context.postId!;
  var prefix = 'In response to ';
  if (id.startsWith('t1_')) {
    const originalComment = await context.reddit.getCommentById(id);
    const originalPermalink = originalComment.permalink;
    prefix += `[your comment](${originalPermalink}):\n\n---\n\n`;
  }
  else if (id.startsWith('t3_')) {
    const originalPost = await context.reddit.getPostById(id);
    const originalPermalink = originalPost.permalink;
    prefix += `[your post](${originalPermalink}):\n\n---\n\n`;
  }
  return prefix;
}

// Helper function to get username of original author of comment or post.
export async function getAuthorsUsername(context: Devvit.Context) {
  const id = context.commentId ?? context.postId!;
  var username = '';
  // Determine if the current context is a comment or post and return the author name accordingly
  if (id.startsWith('t1_')) {
    const originalComment = await context.reddit.getCommentById(id);
    username = originalComment.authorName!;
  }
  // If the ID starts with 't3_', it's a post, so return the author name from the post
  else if (id.startsWith('t3_')) {
    const originalPost = await context.reddit.getPostById(id);
    username = originalPost.authorName!;
  }
  return username;
}

// Helper function that handles the PM to user.
export async function pmUser(
  username: string,
  savedResponse: string,
  pmAsSubreddit: boolean,
  context: Devvit.Context
) {
  const subredditName = await context.reddit.getCurrentSubredditName()!;
  const subjectText = `A message from r/${subredditName}`;
  const prefix = await getPmPrefix(context);
  var messageText = prefix + savedResponse;
  if (pmAsSubreddit) {
    const newConvo = await context.reddit.modMail.createConversation({
      subject: subjectText,
      body: messageText,
      isAuthorHidden: true,
      to: username,
      subredditName: subredditName
    });
    const convoId = newConvo.conversation.id!;
    // Archive the modmail conversation if PMing as subreddit
    await context.reddit.modMail.reply({
      body: `Originally sent by u/${context.username!}.`,
      isAuthorHidden: false,
      isInternal: true,
      conversationId: convoId
    })
    try { await context.reddit.modMail.archiveConversation(convoId); }
    catch {} // Catch needed in case modmail is sent to a mod, since mod discussions can't be archived.
  }
  else { // PM by bot account, NOT modmail
    messageText += `\n\n---\n\n*This inbox is not monitored. If you have any questions, please message the moderators of r/${subredditName}.*`;
    await context.reddit.sendPrivateMessage({
      subject: subjectText,
      text: messageText,
      to: username,
    });
    const id = context.commentId ?? context.postId!;
    await addModNoteForPm(username, context);
  }
}

// Helper function to add a mod note to the app account when a saved response is left as comment (and who left it)
export async function addModNote(id: string, context: Devvit.Context) {
  const noteText = `Saved Response left by u/${context.username!}.`;
  await context.reddit.addModNote({
    subreddit: context.subredditName!,
    user: context.appSlug,
    note: noteText,
    redditId: id as PostOrCommentId,
  });
}

// Helper function to add a mod note to the app account when a saved response is sent as PM (and who sent it)
async function addModNoteForPm(username: string, context: Devvit.Context) {
  const noteText = `PM sent to u/${username} by u/${context.username!}.`;
  const id = context.commentId ?? context.postId!;
  await context.reddit.addModNote({
    subreddit: context.subredditName!,
    user: context.appSlug,
    note: noteText,
    redditId: id as PostOrCommentId,
  });
}

// Helper function to get pre-filtered list of Removal Reasons
export async function getFilteredRemovalReasons(context: Devvit.Context) {
  const unfilteredReasons = await context.reddit.getSubredditRemovalReasons(context.subredditName!);
  const keywordList = (await context.settings.get("title-keywords")) as string;
  if (keywordList == undefined || keywordList.trim() == "")
    return unfilteredReasons;
  const keywords = keywordList.trim().split(',');
  var filteredReasons: RemovalReason[] = [];
  for (let i = 0; i < unfilteredReasons.length; i++) {
    for (let j = 0; j < keywords.length; j++) {
      const keyword = keywords[j].trim();
      if (keyword != '' && unfilteredReasons[i].title.includes(keyword)) {
        filteredReasons.push(unfilteredReasons[i]);
        break;
      }
    }
  }
  return filteredReasons;
}