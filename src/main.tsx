// Learn more at developers.reddit.com/docs
import {
  //CommentCreate,
  //CommentCreateDefinition,
  //CommentDelete,
  Comment,
  Devvit,
  MenuItemOnPressEvent,
  //Post,
  RemovalReason,
  //SettingScope,
  //TriggerContext,
  //User,
  //useState,
  ModMailService,
  ModMailConversationState,
} from "@devvit/public-api";

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
  {
    type: "boolean",
    name: "pm-as-subreddit",
    label: "Message as subreddit by default",
    defaultValue: true,
    helpText:
      `This setting affects the default value of the "Message as subreddit" option on the pop-up.`,
    scope: "installation",
  },
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

// Button for form to create mod post
Devvit.addMenuItem({
  label: "Create Mod-Team Post",
  location: "subreddit", // can also be 'comment' or 'subreddit'
  forUserType: "moderator",
  onPress: async (event, context) => {
    const subredditName = await context.reddit.getCurrentSubredditName();
    context.ui.showForm(postForm, { subredditName: subredditName });
  },
});

// Pop-up form at subreddit level to create a mod post
const postForm = Devvit.createForm(
  (data) => (
    {
      title: 'Create Mod Post',
      description: `Create a new post that will be posted by the u/saved-response bot account.`,
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
    const postTitle = String(event.values.postTitle);
    const postBody = String(event.values.postBody);
    const subredditName = context.subredditName!;
    const pinPost = Boolean(event.values.pinPost);
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
      context.ui.showToast('Post created successfully.');
    }
  }
);

// Pop-up form for leaving a saved response
const savedResponseForm = Devvit.createForm(
  (data) => (
    {
      title: 'Select Saved Response',
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
    const reasonText = String(event.values.savedResponse);
    const editResponse = Boolean(event.values.editResponse);
    const lockResponse = Boolean(event.values.lockResponse);
    const pinResponse = Boolean(event.values.pinResponse);
    const isPost = Boolean(id.startsWith('t3_')); // Check if the ID starts with 't3_' to determine if it's a post

    // If the user chooses to edit the response first, call the other form.
    if (editResponse) {
      context.ui.showForm(editResponseForm, { id: id, reasonText: reasonText, lockResponse: lockResponse, pinResponse: pinResponse, isPost: isPost });
    }
    // If the user chooses NOT to edit the response first, proceed with leaving a comment.
    else {
      const newComment = await context.reddit.submitComment({ id: id, text: reasonText });
      await newComment.distinguish(pinResponse); // Always distinguish the comment as mod.
      // If the user chooses to lock the comment, proceed with comment lock.
      if (lockResponse)
        await newComment.lock();
      context.ui.showToast('Saved response posted as comment.');
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
    const reasonText = String(event.values.responseText);
    const newComment = await context.reddit.submitComment({ id: id, text: reasonText });
    await newComment.distinguish(event.values.pinResponse); // Always distinguish the comment as mod.
    // If the user chooses to lock the comment, proceed with comment lock.
    if (event.values.lockResponse)
      await newComment.lock();
    context.ui.showToast('Saved response posted as comment.');
  }
);

// Pop-up form for PMing a saved response
const savedResponsePMForm = Devvit.createForm(
  (data) => (
    {
      title: 'Select Saved Response',
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
    const reasonText = String(event.values.savedResponse);
    const editResponse = Boolean(event.values.editResponse);
    const pmAsSubreddit = Boolean(event.values.pmAsSubreddit);
    // If the user chooses to edit the response first, call the other form.
    if (editResponse) {
      context.ui.showForm(editResponsePMForm, { reasonText: reasonText, pmAsSubreddit: pmAsSubreddit  })
    }
    // If the user chooses NOT to edit the response first, proceed with PM.
    else {
      const username = await getAuthorsUsername(context);
      await pmUser(username, reasonText, pmAsSubreddit, context);
      context.ui.showToast('Saved response sent as PM.');
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
          helpText: "Don't bother linking to the post or comment you're responding to; the private message will include a prefix with that information"
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
    const reasonText = String(event.values.responseText);
    const username = await getAuthorsUsername(context);
    const pmAsSubreddit = Boolean(event.values.pmAsSubreddit);
    await pmUser(username, reasonText, pmAsSubreddit, context);
    context.ui.showToast('Saved response sent as PM.');
  }
);

// Button on posts to comment a saved response
Devvit.addMenuItem({
  label: "Comment Saved Response",
  location: "post",
  forUserType: "moderator",
  onPress: async (event, context) => {
    await commentSavedResponse(context);
  },
});

// Button on comments to comment a saved response
Devvit.addMenuItem({
  label: "Comment Saved Response",
  location: "comment",
  forUserType: "moderator",
  onPress: async (event, context) => {
    await commentSavedResponse(context);
  },
});

// Button on posts to PM a saved response
Devvit.addMenuItem({
  label: "Message Saved Response",
  location: "post",
  forUserType: "moderator",
  onPress: async (event, context) => {
    await pmSavedResponse(context);
  },
});

// Button on comments to PM a saved response
Devvit.addMenuItem({
  label: "Message Saved Response",
  location: "comment",
  forUserType: "moderator",
  onPress: async (event, context) => {
    await pmSavedResponse(context);
  },
});

// Helper function to show the initial pop-up upon clicking the "Leave Saved Response" menu item in a post or comment
async function commentSavedResponse(context: Devvit.Context) {
  const unfilteredReasons = await context.reddit.getSubredditRemovalReasons(context.subredditName!);
  const keywordsTemp = await context.settings.get('title-keywords');
  var keywords = '';
  if (keywordsTemp!=undefined)
    keywords = String(keywordsTemp).trim();

  const reasons = filterReasonsByKeywords(unfilteredReasons, keywords);
  const lockBool = await context.settings.get('lock-response');
  const editBool = await context.settings.get('edit-response');
  const pinBool = await context.settings.get('pin-response');
  const lockSetting = Boolean(lockBool);
  const editSetting = Boolean(editBool);
  const pinSetting = Boolean(pinBool);
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
  const unfilteredReasons = await context.reddit.getSubredditRemovalReasons(context.subredditName!);
  const keywordsTemp = await context.settings.get('title-keywords');
  var keywords = '';
  if (keywordsTemp!=undefined)
    keywords = String(keywordsTemp).trim();

  const reasons = filterReasonsByKeywords(unfilteredReasons, keywords);
  const pmAsSubBool = await context.settings.get('pm-as-subreddit');
  const editBool = await context.settings.get('edit-response');
  const pmAsSubreddit = Boolean(pmAsSubBool);
  const editSetting = Boolean(editBool);
  context.ui.showForm(savedResponsePMForm, { reasons: reasons, editSetting: editSetting, pmAsSubreddit: pmAsSubreddit });
}

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
async function getAuthorsUsername(context: Devvit.Context) {
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
async function pmUser(
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
    await context.reddit.sendPrivateMessageAsSubreddit({
      subject: subjectText,
      text: messageText,
      to: username,
      fromSubredditName: subredditName,
    });
    // Archive the modmail conversation if PMing as subreddit
    await archiveModmail(username, subjectText, context);
  }
  else {
    messageText += `\n\n---\n\n*This inbox is not monitored. If you have any questions, please message the moderators of r/${subredditName}.*`;
    await context.reddit.sendPrivateMessage({
      subject: subjectText,
      text: messageText,
      to: username,
    });
  }
}

// Helper function to archive modmail conversation after sending message as subreddit
async function archiveModmail(username: string, subjectText: string, context: Devvit.Context) {
  // Fetch recent modmail conversations
  const { viewerId, conversations } = await context.reddit.modMail.getConversations({
    limit: 25,
    sort: 'mod',
  });
  // Convert conversations object to an array for easier iteration
  const arrayOfConversations = Object.values(conversations);

  // Find the conversation with the matching subject and participant
  for (const convo of arrayOfConversations) {
    if (convo.subject === subjectText && convo.participant?.name === username && convo.state !== ModMailConversationState.Archived) {
      await context.reddit.modMail.archiveConversation(convo.id!);
      break; // Exit the loop after archiving the relevant conversation
    }
  }
}

// Helper function to determine if the title of a Removal Reason contains a specific word or phrase from a list.
// Expects a fully trimmed list with no leading or trailing spaces.
function filterReasonsByKeywords(reasons: RemovalReason[], keywords: string) {
  if (keywords == '')
    return reasons;
  const keywordsArr = keywords.split(',');
  var filteredReasons: RemovalReason[] = [];
  for (let i = 0; i < reasons.length; i++) {
    for (let j = 0; j < keywordsArr.length; j++) {
      const keyword = keywordsArr[j].trim();
      if (keyword != '' && reasons[i].title.includes(keyword)) {
        filteredReasons.push(reasons[i]);
        break;
      }
    }
  }
  return filteredReasons;
}

export default Devvit;