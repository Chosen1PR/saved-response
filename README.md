## Features

This app allows moderators to respond with one of their saved Removal Reasons without having to remove a post or comment. You can also:
- Edit the response before sending.
- Leave the response as a comment or send it as a private message.
- Pin and/or lock comments immediately on posting.
- Choose whether PMs are sent from the subreddit (as modmail) or from the bot (whose inbox is *not* monitored).
- Configure the default options for editing responses, locking comments, and PMing as the subreddit. You'll still be able to adjust these settings while responding, but the defaults can be changed to your most frequently used preferences.
- Define a list of case-sensitive keywords or phrases that *must* be in a Removal Reason's title for it to be included for selection. This could be useful if, for example, you have some removal reasons that include the word "Warning" in the title, to distinguish them from reasons that have messages meant for actual removal of content.
- Create a new post with the bot account. This can help if you want to make a post on behalf of the entire mod team without using your personal account.

---

## Changelog

### [0.0.29] (2025-11-28)

#### Features

- Added an error message when a private message or modmail fails to send to a user.
- Added a menu item at subreddit level for config settings.

### [0.0.27] (2025-11-12)

#### Features

- Added the ability to make a post with the u/saved-response bot account.
- Changed "PM" references to "Message" for clarity.
- Migrated app to Devvit Web.

### [0.0.26] (2025-10-10)

#### Features

- If sending a response as a private message from the subreddit, the modmail will now be archived automatically instead of showing up in your inbox.

### [0.0.24] (2025-06-25)

#### Features

- Updated to use new Devvit platform version 0.11.17.

#### Bug Fixes

- Fixed a bug that always sent a PM to the author of the post even if you were actually responding to a comment in the post.

### [0.0.22] (2025-06-22)

#### Features

- **By popular demand!** You can now choose whether or not to pin a response comment to the top of a post, assuming that you are responding to the post itself and not to another comment. When responding to a comment, the option to pin will be greyed out.
- In the config settings, you can now set a default behavior for whether or not to pin the response.

### [0.0.21] (2025-06-16)

#### Features

- In the configuration settings, you can now provide a list of case-sensitive keywords or phrases that *must* be in a Removal Reason's title for it to be included for selection in the app's pop-up. It even works with some special characters, but not commas (since they are used for separation of keywords).

### [0.0.20] Initial version (2025-06-10)

#### Features

- Send a Saved Response (only works with Removal Reasons) without having to action on a post or comment.
- Edit the response before sending.
- Leave the response as a comment or send it as a private message.
- Lock comments immediately on posting.
- Choose whether PMs are sent from the subreddit or from u/saved-response.
- Configure the default settings for editing responses, locking comments, and PMing as the subreddit.

#### Bug Fixes

None yet (initial version). Please send a private message to the developer (u/Chosen1PR) to report bugs.