import { Response } from "express";
import { RemovalReason } from "@devvit/web/server";

export function loadModTeamPostForm(res: Response) {
  res.json({
    showForm: {
      name: 'postForm',
      form: {
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
            lineHeight: 15,
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
      }
    }
  });
}

export function loadSavedResponseForm(
  reasons: RemovalReason[],
  isPost: boolean,
  pinSetting: boolean,
  lockSetting: boolean,
  editSetting: boolean,
  res: Response
) {
  res.json({
    showForm: {
      name: 'savedResponseForm',
      form: {
        title: 'Comment Saved Response',
        fields: [
          {
            type: 'select',
            name: 'savedResponse',
            label: 'Select a saved response',
            options: reasons.map((reasons: RemovalReason) => ({
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
            defaultValue: isPost && pinSetting,
            disabled: !isPost, // Disable if isPost is false
          },
          {
            type: 'boolean',
            name: 'lockResponse',
            label: 'Lock response',
            defaultValue: lockSetting,
          },
          {
            type: 'boolean',
            name: 'editResponse',
            label: 'Edit response',
            defaultValue: editSetting,
          }
        ],
        acceptLabel: 'Submit',
        cancelLabel: 'Cancel',
      }
    }
  });
}

export function loadEditResponseForm(
  reasonText: string,
  isPost: boolean,
  pinResponse: boolean,
  lockResponse: boolean,
  res: Response
) {
  res.json({
    showForm: {
      name: 'editResponseForm',
      form: {
        title: 'Edit Saved Response',
        fields: [
          {
            type: 'paragraph',
            name: 'responseText',
            label: 'Edit your saved response',
            defaultValue: reasonText,
            lineHeight: 5,
            required: true,
            helpText: "If you're not removing a post or comment, you should remove any and all references to removal" + ".",
          },
          {
            type: 'boolean',
            name: 'pinResponse',
            label: 'Pin response',
            defaultValue: isPost && pinResponse,
            disabled: !isPost, // Disable if isPost is false
          },
          {
            type: 'boolean',
            name: 'lockResponse',
            label: 'Lock response',
            defaultValue: lockResponse,
          },
        ],
        acceptLabel: 'Submit',
        cancelLabel: 'Cancel',
      }
    }
  });
}

export function loadSavedResponsePMForm(
  reasons: RemovalReason[],
  pmAsSubreddit: boolean,
  editSetting: boolean,
  res: Response
) {
  res.json({
    showForm: {
      name: 'savedResponsePMForm',
      form: {
        title: 'Message Saved Response',
        fields: [
          {
            type: 'select',
            name: 'savedResponse',
            label: 'Select a saved response',
            options: reasons.map((reasons: RemovalReason) => ({
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
            defaultValue: pmAsSubreddit
          },
          {
            type: 'boolean',
            name: 'editResponse',
            label: 'Edit response',
            defaultValue: editSetting,
            required: true,
          }
        ],
        acceptLabel: 'Submit',
        cancelLabel: 'Cancel',
      }
    }
  });
}

export function loadEditResponsePMForm(
  reasonText: string,
  pmAsSubreddit: boolean,
  res: Response
) {
  res.json({
    showForm: {
      name: 'editResponsePMForm',
      form: {
        title: 'Edit Saved Response',
        fields: [
          {
            type: 'paragraph',
            name: 'responseText',
            label: 'Edit your saved response',
            defaultValue: reasonText,
            lineHeight: 5,
            required: true,
            helpText: "The private message will include a prefix with information about the post or comment you're responding to"
              + ". If you're not removing a post or comment, you should remove any and all references to removal.",
          },
          {
            type: 'boolean',
            name: 'pmAsSubreddit',
            label: 'Message as subreddit',
            defaultValue: pmAsSubreddit
          },
        ],
        acceptLabel: 'Submit',
        cancelLabel: 'Cancel',
      }
    }
  });
}