import express from "express";

import {
  createServer,
  context,
  getServerPort,
  reddit,
  settings
} from "@devvit/web/server";

import type { PostOrCommentId } from "./types";

import {
  getAuthorsUsername,
  getRequestBodyValue,
  getRequestBodyValueAsBoolean,
  isUserMod,
  getPostOrComment,
  addModNote,
  pmUser,
  getFilteredRemovalReasons
} from "./utils";

import {
  cacheTargetId,
  getCachedTargetId,
  deleteCachedModData
} from "./redis";

import {
  loadSavedResponseForm,
  loadSavedResponsePMForm,
  loadModTeamPostForm,
  loadEditResponseForm,
  loadEditResponsePMForm
} from "./forms"

//import type { Request, Response } from 'express';
//import { UiResponse } from '@devvit/web/shared';

const app = express();

// Middleware for JSON body parsing
app.use(express.json());
// Middleware for URL-encoded body parsing
app.use(express.urlencoded({ extended: true }));
// Middleware for plain text body parsing
app.use(express.text());

const router = express.Router();

// Menu item which launches Mod-Team Post form
router.post("/internal/menu/create-modteam-post", async (_req, res) => {
  loadModTeamPostForm(res);
});

// Form handler for Mod-Team Post
router.post("/internal/forms/modteam-post-submit", async (req, res) => {
  const postTitle = getRequestBodyValue(req.body, ['postTitle']),
  postBody = getRequestBodyValue(req.body, ['postBody']),
  subredditName = context.subredditName!,
  pinPost = getRequestBodyValueAsBoolean(req.body, ['pinPost']);
  try {
    // Create the post in the specified subreddit
    const newPost = await reddit.submitPost({
      subredditName: subredditName,
      title: postTitle,
      text: postBody,
    });
    // If the post was created successfully, distinguish and pin it as needed
    if (newPost) {
      await newPost.distinguish();
      if (pinPost)
        await newPost.sticky();
      await addModNote(newPost.id);
      res.json({
        navigateTo: `https://www.reddit.com${newPost.permalink}`
      });
    }
  }
  catch (error) {
    console.log(`General error:\n${error}`);
  }
});

// Menu item which launches Saved Response form
router.post("/internal/menu/comment-saved-response", async (_req, res) => {
  try {
    const reasons = await getFilteredRemovalReasons();
    const lockSetting = (await settings.get('lock-response')) as boolean;
    const editSetting = (await settings.get('edit-response')) as boolean;
    const pinSetting = (await settings.get('pin-response')) as boolean;
    // Determine if the current context is a post or comment
    const id = context.commentId ?? context.postId!;
    let isPost = false;
    if (id.startsWith('t3_')) {
      isPost = true;
    }
    await cacheTargetId(context.username!, id);
    loadSavedResponseForm(reasons, isPost, pinSetting, lockSetting, editSetting, res);
  }
  catch (error) {
    console.log(`General error:\n${error}`);
  }
});

// Form handler for Saved Response form
router.post("/internal/forms/saved-response-submit", async (req, res) => {
  // Leave a comment on the post with the selected removal reason text
  const reasonText = getRequestBodyValue(req.body, ['savedResponse']),
  editResponse = getRequestBodyValueAsBoolean(req.body, ['editResponse']),
  lockResponse = getRequestBodyValueAsBoolean(req.body, ['lockResponse']),
  pinResponse = getRequestBodyValueAsBoolean(req.body, ['pinResponse']);
  try {
    //const id = context.commentId ?? context.postId!,
    const id = await getCachedTargetId(context.username!),
    isPost = id.startsWith('t3_'); // Check if the ID starts with 't3_' to determine if it's a post
    // If the user chooses to edit the response first, call the other form.
    if (editResponse) {
      loadEditResponseForm(reasonText, isPost, pinResponse, lockResponse, res);
    }
    // If the user chooses NOT to edit the response first, proceed with leaving a comment.
    else {
      const newComment = await reddit.submitComment({ id: id as PostOrCommentId, text: reasonText });
      await newComment.distinguish(pinResponse); // Always distinguish the comment as mod.
      // If the user chooses to lock the comment, proceed with comment lock.
      if (lockResponse)
        await newComment.lock();
      await addModNote(newComment.id);
      await deleteCachedModData(context.username!);
      res.json({
        showToast: 'Saved response submitted as comment.'
      });
    }
  }
  catch (error) {
    console.log(`General error:\n${error}`);
  }
});

// Form handler for Edit Response form
router.post("/internal/forms/edit-response-submit", async (req, res) => {
  // Leave a comment on the post with the selected removal reason text
  const reasonText = getRequestBodyValue(req.body, ['responseText']),
  pinResponse = getRequestBodyValueAsBoolean(req.body, ['pinResponse']),
  lockResponse = getRequestBodyValueAsBoolean(req.body, ['lockResponse']);
  try {
    //const id = context.commentId ?? context.postId!;
    const id = await getCachedTargetId(context.username!);
    const newComment = await reddit.submitComment({ id: id as PostOrCommentId, text: reasonText });
    await newComment.distinguish(pinResponse); // Always distinguish the comment as mod.
    // If the user chooses to lock the comment, proceed with comment lock.
    if (lockResponse)
      await newComment.lock();
    await addModNote(newComment.id);
    await deleteCachedModData(context.username!);
    res.json({
      showToast: 'Saved response submitted as comment.'
    });
  }
  catch (error) {
    console.log(`General error:\n${error}`);
  }
});

// Menu item which launches Saved Response PM form
router.post("/internal/menu/message-saved-response", async (_req, res) => {
  try {
    const reasons = await getFilteredRemovalReasons();
    const pmAsSubreddit = (await settings.get('pm-as-subreddit')) as boolean;
    const editSetting = (await settings.get('edit-response')) as boolean;
    const id = context.commentId ?? context.postId!;
    await cacheTargetId(context.username!, id);
    loadSavedResponsePMForm(reasons, pmAsSubreddit, editSetting, res);
  }
  catch (error) {
    console.log(`General error:\n${error}`);
  }
});

// Form handler for Saved Response PM form
router.post("/internal/forms/saved-response-pm-submit", async (req, res) => {
  // PM the user with the selected removal reason text
  const reasonText = getRequestBodyValue(req.body, ['savedResponse']),
  editResponse = getRequestBodyValueAsBoolean(req.body, ['editResponse']),
  pmAsSubreddit = getRequestBodyValueAsBoolean(req.body, ['pmAsSubreddit']);
  
  // If the user chooses to edit the response first, call the other form.
  if (editResponse) {
    loadEditResponsePMForm(reasonText, pmAsSubreddit, res);
  }
  // If the user chooses NOT to edit the response first, proceed with PM.
  else {
    const username = await getAuthorsUsername();
    try {
      await pmUser(username, reasonText, pmAsSubreddit);
      res.json({
        showToast: 'Saved response sent as message.'
      });
    }
    // If PM wasn't sent, catch the error and inform mod.
    catch (error) {
      if (error == "NOT_WHITELISTED_BY_USER_MESSAGE")
        res.json({
          showToast: `Error: u/${username} might have messaging disabled.`
        });
      else
        res.json({
          showToast: `Error: Message not sent.`
        });
    }
  }
});

// Form handler for Edit Response PM form
router.post("/internal/forms/edit-response-pm-submit", async (req, res) => {
  // PM user with the selected removal reason text
  const reasonText = getRequestBodyValue(req.body, ['responseText']),
  pmAsSubreddit = getRequestBodyValueAsBoolean(req.body, ['pmAsSubreddit']);
  const username = await getAuthorsUsername();
  try {
    await pmUser(username, reasonText, pmAsSubreddit);
    res.json({
      showToast: 'Saved response sent as message.'
    });
  }
  // If PM wasn't sent, catch the error and inform mod.
  catch (error) {
    if (error == "NOT_WHITELISTED_BY_USER_MESSAGE")
      res.json({
        showToast: `Error: u/${username} might have messaging disabled.`
      });
    else
      res.json({
        showToast: `Error: Message not sent.`
      });
  }
});

// Trigger handler for comment create
// Is only used to delete posts and comments from u/saved-response.
router.post('/internal/triggers/on-comment-create', async (req, res) => {
  const commentBody = getRequestBodyValue(req.body, ['comment', 'body']);
  if (commentBody.trim() == '!delete') {
    try {
      const username = getRequestBodyValue(req.body, ['author', 'name']),
      parentId = getRequestBodyValue(req.body, ['comment', 'parentId']);
      if (await isUserMod(username)) {
        const parentPostOrComment = await getPostOrComment(parentId);
        if (parentPostOrComment) {
          if (parentPostOrComment.authorName == context.appSlug) {
            await parentPostOrComment.delete();
          }
        }
      }
      res.status(200).json({ status: 'ok' });
    }
    catch (error) {
      console.log(`General error:\n${error}`);
    }
  }
});

// Trigger handler for app upgrades
//router.post('/internal/triggers/on-app-upgrade', async (_req, _res) => {
  //const installer = req.body.installer;
  //console.log('Installer:', JSON.stringify(installer, null, 2));
  //res.status(200).json({ status: 'ok' });
//});

app.use(router);

const server = createServer(app);
server.on("error", (err) => console.error(`server error: ${err.stack}`));
server.listen(getServerPort());