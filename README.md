# All My Posts

A viewer and search engine for your Bluesky and Mastodon worlds. This tool provides two core functionalities: a unified interface to view, analyze, and export your own social media history, and a unique search engine to discover content across the networks filtered by your social graph.

## Key Features

This application is divided into two main tools:

### 1\. The Feed Viewer & Archive Tool

This is the original functionality for managing your own content history.

  - **Multi-Platform Feed**: Fetch your posts, replies, and saved content from Bluesky (Posts, Likes) and Mastodon (Posts, Favorites, Bookmarks) into a single view.
  - **Synoptic Crosspost View**: Automatically detects and displays similar posts from both platforms side-by-side.
  - **Comprehensive Loading**: Fetch entire user feeds with "Load More" and "Load All" options to get a complete history.
  - **Advanced Filtering & Sorting**: Sift through posts with full-text search, hide replies/reposts, filter by media, set a minimum like count, and sort by newest, oldest, or engagement.
  - **Analytics Dashboard**: Get insights into your posting habits, including activity by hour and your top-performing posts.
  - **Data Export**: Export your current filtered view to multiple formats, including **JSON**, **CSV**, **HTML**, **Markdown**, or a plain text list of **URLs**.

### 2\. Personalized Network Search

A discovery tool designed to find relevant content from the accounts you trust.

  - **Follow-Filtered Search**: Search for phrases across Bluesky and Mastodon, with results limited to posts from accounts you explicitly follow.
  - **Personalized "Best Match" Ranking**: Builds a private "affinity index" based on your recent like/favorite history to rank search results according to your personal preferences.
  - **Real-time Progress**: Uses Server-Sent Events (SSE) to provide live feedback during long-running operations like building your ranker.
  - **Browser-Based Caching**: Securely caches your affinity index in your browser's `localStorage` for fast, repeated searches, ensuring your data stays on your machine.

-----

## Tech Stack

  - **Framework**: [Next.js](https://nextjs.org/) (App Router)
  - **Language**: [TypeScript](https://www.typescriptlang.org/)
  - **Styling**: [Tailwind CSS](https://tailwindcss.com/)
  - **Platform APIs**:
      - Bluesky: [@atproto/api](https://github.com/bluesky-social/atproto/tree/main/packages/api)
      - Mastodon: [masto](https://www.google.com/search?q=https://github.com/neet/masto.js)
  - **Real-time Updates**: Server-Sent Events (SSE)
  - **Session Management**: [iron-session](https://github.com/vvo/iron-session)
  - **Caching**: Browser `localStorage` for client-side affinity index.
  - **Deployment**: [Vercel](https://vercel.com/)

-----

## Getting Started

Follow these instructions to get a copy of the project up and running on your local machine.

### Prerequisites

  - [Node.js](https://nodejs.org/) (v18 or later recommended)
  - [npm](https://www.npmjs.com/) (or your preferred package manager)

### Installation & Setup

1.  **Clone the repository:**

    ```bash
    git clone https://github.com/CrispStrobe/allmyposts.git
    cd allmyposts
    ```

2.  **Install dependencies:**

    ```bash
    npm install
    ```

3.  **Set up your environment variables:**
    Create a new file named `.env.local` in the root of the project and add the following variables.

    ```ini
    # .env.local

    # Required for Bluesky API access. Higher rate limits.
    BLUESKY_HANDLE="your-handle.bsky.social"
    BLUESKY_APP_PASSWORD="xxxx-xxxx-xxxx-xxxx"

    # Required for encrypting session cookies (used for Mastodon login).
    # Generate a strong, random 32+ character string for this.
    SESSION_PASSWORD="your_super_secret_and_long_session_password_here"
    ```

    > **Note:** A Bluesky App Password can be created in your Bluesky Settings under "App passwords". For Mastodon, authentication is handled via OAuth2 and doesn't require storing credentials.

4.  **Run the development server:**

    ```bash
    npm run dev
    ```

Open [http://localhost:3000](https://www.google.com/search?q=http://localhost:3000) with your browser to see the result.

-----

## Deployment

This application is optimized for deployment on [Vercel](https://vercel.com/).

1.  **Push to GitHub:** Ensure your repository is up-to-date on GitHub.
2.  **Import to Vercel:** From your Vercel dashboard, select "Add New... \> Project" and import your GitHub repository.
3.  **Add Environment Variables:** In the Vercel project settings, navigate to **Settings \> Environment Variables** and add all three of the variables from your `.env.local` file:
      - `BLUESKY_HANDLE`
      - `BLUESKY_APP_PASSWORD`
      - `SESSION_PASSWORD`
4.  **Deploy:** Click the "Deploy" button. Vercel will build and deploy your application.

## License

This project is licensed under the Apache 2.0 License. See the [LICENSE](https://www.apache.org/licenses/LICENSE-2.0) file for details.