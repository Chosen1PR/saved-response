// Learn more at developers.reddit.com/docs
import {
  Devvit,
  RemovalReason,
} from "@devvit/public-api";

import {
  getAuthorsUsername,
  pmUser,
  addModNote,
  getFilteredRemovalReasons,
} from "./utils.js";

Devvit.configure({
  redis: true,
  redditAPI: true,
});

Devvit.addSettings([
  // Config setting for default value for pinning response comment
  {
    type: "boolean",
    name: "pin-response",
    label: "Pin response by default",
    defaultValue: true,
    helpText:
      `This setting affects the default value of the "Pin response" option on the pop-up.`,
    scope: "installation",
  },
  // Config setting for default value for locking response comment
  {
    type: "boolean",
    name: "lock-response",
    label: "Lock response by default",
    defaultValue: true,
    helpText:
      `This setting affects the default value of the "Lock response" option on the pop-up.`,
    scope: "installation",
  },
  // Config setting for default value for editing response comment
  {
    type: "boolean",
    name: "edit-response",
    label: "Edit response by default",
    defaultValue: false,
    helpText:
      `This setting affects the default value of the "Edit response" option on the pop-up.`,
    scope: "installation",
  },
  // Config setting for PMing as subreddit (i.e. modmail)
  {
    type: "boolean",
    name: "pm-as-subreddit",
    label: "Private message as subreddit by default",
    defaultValue: true,
    helpText:
      `This setting affects the default value of the "Message as subreddit" option on the pop-up.`,
    scope: "installation",
  },
  // Config setting for reason title keywords
  {
    type: "paragraph",
    name: "title-keywords",
    label: "Keywords in reason title (case-sensitive)",
    lineHeight: 1,
    helpText:
      `Enter a comma (,) separated list of case-sensitive keywords or phrases that MUST be in the removal reason's title for it to be included for selection` +
      ` in the pop-up (e.g. the word "Warning"). Works with certain special characters like brackets or quotes, but not commas.`+
      ` Leave blank for no title restrictions.`,
    scope: "installation",
  },
]);

// Button for app settings
Devvit.addMenuItem({
  label: "Reason without Removal",
  description: "Settings",
  location: "subreddit", // can also be 'comment' or 'subreddit'
  forUserType: "moderator",
  onPress: async (event, context) => {
    context.ui.navigateTo(`https://developers.reddit.com/r/${context.subredditName!}/apps/${context.appSlug}`);
  },
});

// Button for form to create mod post
Devvit.addMenuItem({
  label: "Create Mod-Team Post",
  location: "subreddit", // can also be 'comment' or 'subreddit'
  forUserType: "moderator",
  onPress: async (event, context) => {
    context.ui.showForm(postForm, { subredditName: context.subredditName! });
  },
});

// Pop-up form at subreddit level to create a mod post
const postForm = Devvit.createForm(
  (data) => (
    {
      title: 'Create Mod Post',
      description: `Create a new post that will be posted by the u/saved-response account.`,
      fields: [
      {
        type: 'string',
        name: 'postTitle',
        label: 'Post Title',
        required: true,
        helpText: 'Enter the title of your post.',
      },
      {
        type: 'paragraph',
        name: 'postBody',
        label: 'Post Body',
        required: true,
        lineHeight: 10,
        helpText: 'Write the body of your post here. You can use markdown formatting.',
      },
      {
        type: 'boolean',
        name: 'pinPost',
        label: 'Pin Post',
        helpText: 'Pin your post to the Community Highlights section.',
      }],
      acceptLabel: 'Submit',
      cancelLabel: 'Cancel',
  }),
  async (event, context) => {
    const postTitle = event.values.postTitle as string;
    const postBody = event.values.postBody as string;
    const subredditName = context.subredditName!;
    const pinPost = event.values.pinPost as boolean;
    // Create the post in the specified subreddit
    const newPost = await context.reddit.submitPost({
      subredditName: subredditName,
      title: postTitle,
      text: postBody,
    });
    // If the post was created successfully, distinguish and pin it as needed
    if (newPost) {
      await newPost.distinguish();
      if (pinPost)
        await newPost.sticky();
      await addModNote(newPost.id, context);
      context.ui.navigateTo(`https://www.reddit.com${newPost.permalink}`);
    }
  }
);

// Pop-up form for leaving a saved response
const savedResponseForm = Devvit.createForm(
  (data) => (
    {
      title: 'Comment Saved Response',
      fields: [
      {
        type: 'select',
        name: 'savedResponse',
        label: 'Select a saved response',
        options: data.reasons.map((reasons: RemovalReason) => ({
          label: reasons.title,
          value: reasons.message,
        })),
        required: true,
        helpText: 'Reminder: This functionality only works with Removal Reasons' + '.',
      },
      {
        type: 'boolean',
        name: 'pinResponse',
        label: 'Pin response',
        defaultValue: data.isPost && data.pinSetting,
        disabled: !data.isPost, // Disable if isPost is false
      },
      {
        type: 'boolean',
        name: 'lockResponse',
        label: 'Lock response',
        defaultValue: data.lockSetting,
      },
      {
        type: 'boolean',
        name: 'editResponse',
        label: 'Edit response',
        defaultValue: data.editSetting,
      }
    ],
    acceptLabel: 'Submit',
    cancelLabel: 'Cancel',
  }),
  async (event, context) => {
    // Leave a comment on the post with the selected removal reason text
    const id = context.commentId ?? context.postId!;
    const reasonText = event.values.savedResponse.toString() as string;
    const editResponse = event.values.editResponse as boolean;
    const lockResponse = event.values.lockResponse as boolean;
    const pinResponse = event.values.pinResponse as boolean;
    const isPost = id.startsWith('t3_'); // Check if the ID starts with 't3_' to determine if it's a post

    // If the user chooses to edit the response first, call the other form.
    if (editResponse) {
      context.ui.showForm(editResponseForm, { id: id, reasonText: reasonText, lockResponse: lockResponse, pinResponse: pinResponse, isPost: isPost });
    }
    // If the user chooses NOT to edit the response first, proceed with leaving a comment.
    else {
      console.log(`\nID: ${id}\nreasonText: ${reasonText}\neditResponse: ${editResponse}\nlockResponse: ${lockResponse}\npinResponse: ${pinResponse}\n`);
      const newComment = await context.reddit.submitComment({ id: id, text: reasonText });
      await newComment.distinguish(pinResponse); // Always distinguish the comment as mod.
      // If the user chooses to lock the comment, proceed with comment lock.
      if (lockResponse)
        await newComment.lock();
      await addModNote(newComment.id, context);
      context.ui.showToast('Saved response submitted as comment.');
    }
  }
);

// Pop-up form for editing the saved response before commenting.
const editResponseForm = Devvit.createForm(
  (data) => (
    {
      title: 'Edit Saved Response',
      fields: [
        {
          type: 'paragraph',
          name: 'responseText',
          label: 'Edit your saved response',
          defaultValue: data.reasonText,
          lineHeight: 5,
          required: true,
          helpText: "If you're not removing a post or comment, you should remove any and all references to removal" + ".",
        },
        {
          type: 'boolean',
          name: 'pinResponse',
          label: 'Pin response',
          defaultValue: data.isPost && data.pinResponse,
          disabled: !data.isPost, // Disable if isPost is false
        },
        {
          type: 'boolean',
          name: 'lockResponse',
          label: 'Lock response',
          defaultValue: data.lockResponse,
        },
      ],
      acceptLabel: 'Submit',
      cancelLabel: 'Cancel',
    }
  ), async (event, context) => {
    // Leave a comment on the post with the selected removal reason text
    const id = context.commentId ?? context.postId!;
    const reasonText = event.values.responseText as string;
    const newComment = await context.reddit.submitComment({ id: id, text: reasonText });
    await newComment.distinguish(event.values.pinResponse); // Always distinguish the comment as mod.
    // If the user chooses to lock the comment, proceed with comment lock.
    if (event.values.lockResponse)
      await newComment.lock();
    await addModNote(newComment.id, context);
    context.ui.showToast('Saved response submitted as comment.');
  }
);

// Pop-up form for PMing a saved response
const savedResponsePMForm = Devvit.createForm(
  (data) => (
    {
      title: 'Message Saved Response',
      fields: [
      {
        type: 'select',
        name: 'savedResponse',
        label: 'Select a saved response',
        options: data.reasons.map((reasons: RemovalReason) => ({
          label: reasons.title,
          value: reasons.message,
        })),
        required: true,
        helpText: 'Reminder: This functionality only works with Removal Reasons' + '.',
      },
      {
        type: 'boolean',
        name: 'pmAsSubreddit',
        label: 'Message as subreddit',
        defaultValue: data.pmAsSubreddit
      },
      {
        type: 'boolean',
        name: 'editResponse',
        label: 'Edit response',
        defaultValue: data.editSetting,
        required: true,
      }
    ],
    acceptLabel: 'Submit',
    cancelLabel: 'Cancel',
  }),
  async (event, context) => {
    // PM the user with the selected removal reason text
    const reasonText = event.values.savedResponse as string;
    const editResponse = event.values.editResponse as boolean;
    const pmAsSubreddit = event.values.pmAsSubreddit as boolean;
    // If the user chooses to edit the response first, call the other form.
    if (editResponse) {
      context.ui.showForm(editResponsePMForm, { reasonText: reasonText, pmAsSubreddit: pmAsSubreddit  })
    }
    // If the user chooses NOT to edit the response first, proceed with PM.
    else {
      const username = await getAuthorsUsername(context);
      try {
        await pmUser(username, reasonText, pmAsSubreddit, context);
        context.ui.showToast("Saved response sent as message.");
      }
      // If PM wasn't sent, catch the error and inform mod.
      catch (error) {
        if (error == "NOT_WHITELISTED_BY_USER_MESSAGE")
          context.ui.showToast(`Error: u/${username} might have messaging disabled.`);
        else
          context.ui.showToast(`Error: Message not sent.`);
      }
    }
  }
);

// Pop-up form for editing the saved response before PMing.
const editResponsePMForm = Devvit.createForm(
  (data) => (
    {
      title: 'Edit Saved Response',
      fields: [
        {
          type: 'paragraph',
          name: 'responseText',
          label: 'Edit your saved response',
          defaultValue: data.reasonText,
          lineHeight: 5,
          required: true,
          helpText: "The private message will include a prefix with information about the post or comment you're responding to"
            + ". If you're not removing a post or comment, you should remove any and all references to removal.",
        },
        {
          type: 'boolean',
          name: 'pmAsSubreddit',
          label: 'Message as subreddit',
          defaultValue: data.pmAsSubreddit
        },
      ],
      acceptLabel: 'Submit',
      cancelLabel: 'Cancel',
    }
  ), async (event, context) => {
    // PM user with the selected removal reason text
    const reasonText = event.values.responseText as string;
    const username = await getAuthorsUsername(context);
    const pmAsSubreddit = event.values.pmAsSubreddit as boolean;
    try {
      await pmUser(username, reasonText, pmAsSubreddit, context);
      context.ui.showToast("Saved response sent as message.");
    }
    // If PM wasn't sent, catch the error and inform mod.
    catch (error) {
      if (error == "NOT_WHITELISTED_BY_USER_MESSAGE")
        context.ui.showToast(`Error: u/${username} might have messaging disabled.`);
      else
        context.ui.showToast(`Error: Message not sent.`);
    }
  }
);

// Button on posts/comments to comment a saved response
Devvit.addMenuItem({
  label: "Comment Saved Response",
  location: ["post","comment"],
  forUserType: "moderator",
  onPress: async (event, context) => {
    await commentSavedResponse(context);
  },
});

// Button on posts/comments to PM a saved response
Devvit.addMenuItem({
  label: "Message Saved Response",
  location: ["post","comment"],
  forUserType: "moderator",
  onPress: async (event, context) => {
    await pmSavedResponse(context);
  },
});

// Helper function to show the initial pop-up upon clicking the "Leave Saved Response" menu item in a post or comment
async function commentSavedResponse(context: Devvit.Context) {
  const reasons = await getFilteredRemovalReasons(context);
  const lockSetting = (await context.settings.get('lock-response')) as boolean;
  const editSetting = (await context.settings.get('edit-response')) as boolean;
  const pinSetting = (await context.settings.get('pin-response')) as boolean;
  // Determine if the current context is a post or comment
  const id = context.commentId ?? context.postId!;
  var isPost = false;
  if (id.startsWith('t3_')) {
    isPost = true;
  }
  context.ui.showForm(savedResponseForm, { reasons: reasons, lockSetting: lockSetting, editSetting: editSetting, pinSetting: pinSetting, isPost: isPost });
}

// Helper function to show the initial pop-up upon clicking the "PM Saved Response" menu item in a post or comment
async function pmSavedResponse(context: Devvit.Context) {
  const reasons = await getFilteredRemovalReasons(context);
  const pmAsSubreddit = (await context.settings.get('pm-as-subreddit')) as boolean;
  const editSetting = (await context.settings.get('edit-response')) as boolean;
  context.ui.showForm(savedResponsePMForm, { reasons: reasons, editSetting: editSetting, pmAsSubreddit: pmAsSubreddit });
}

// Keep this menu item commented out except for testing.
/*
Devvit.addMenuItem({
  label: "Delete Saved Response",
  description: "u/saved-response",
  location: ["post","comment"],
  forUserType: "moderator",
  onPress: async (event, context) => {
    const id = event.targetId;
    if (id.startsWith('t3_')) {
      const post = await context.reddit.getPostById(id);
      if (post.authorName == context.appSlug) {
        await post.delete();
        context.ui.showToast(`Post deleted.`);
      }
      else context.ui.showToast(`Post is not by u/${context.appSlug}.`)
    }
    else {
      const comment = await context.reddit.getCommentById(id);
      if (comment.authorName == context.appSlug) {
        await comment.delete();
        context.ui.showToast(`Comment deleted.`);
      }
      else context.ui.showToast(`Comment is not by u/${context.appSlug}.`)
    }
  },
});
*/

export default Devvit;