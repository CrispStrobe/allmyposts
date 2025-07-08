# All My Posts

A web application for viewing, searching, analyzing, and exporting posts from **Bluesky** and **Mastodon** accounts, including a synoptic view to identify crossposted content.

## Key Features

  - **Multi-Platform Fetching**: Load an entire user feed from Bluesky, Mastodon, or both simultaneously.
  - **Synoptic Crosspost View**: Automatically identifies and groups similar posts made on both platforms within a 24-hour window, displaying them side-by-side.
  - **Complete Feed Loading**: Fetch an entire user feed, including replies, with "Load More" and "Load All" options.
  - **Threaded Conversations**: Replies are visually grouped under their parent posts for easy reading.
  - **Smart Search**: An autocomplete search bar suggests Bluesky users as you type.
  - **Analytics Dashboard**: Switch to an analytics view to see key metrics, posting activity by hour, and top-performing posts.
  - **Advanced Filtering & Sorting**: Sift through posts with full-text search, hide replies/reposts, show only posts with media, filter by minimum likes, and sort by newest, oldest, or engagement.
  - **Data Export**: Export the current view of posts to **JSON** (full data) or **CSV** (for spreadsheets).

-----

## Tech Stack

  - **Framework**: [Next.js](https://nextjs.org/) (App Router)
  - **Language**: [TypeScript](https://www.typescriptlang.org/)
  - **Styling**: [Tailwind CSS](https://tailwindcss.com/)
  - **Platform Integration**:
      - Bluesky: [@atproto/api](https://github.com/bluesky-social/atproto/tree/main/packages/api)
      - Mastodon: Direct API calls via `fetch`
  - **Deployment**: [Vercel](https://vercel.com/)

-----

## Getting Started

Follow these instructions to get a copy of the project up and running on your local machine.

### Prerequisites

  - [Node.js](https://nodejs.org/) (v18 or later recommended)
  - [npm](https://www.npmjs.com/)

### Installation & Setup

1.  **Clone the repository:**

    ```bash
    git clone https://github.com/your-username/allmyposts.git
    cd allmyposts
    ```

2.  **Install dependencies:**

    ```bash
    npm install
    ```

3.  **Set up your environment variables:**
    Create a new file named `.env.local` in the root of the project. For the application to fetch data from private accounts or to get higher rate limits, you must provide Bluesky credentials.

    ```
    # .env.local
    BLUESKY_HANDLE="your-handle.bsky.social"
    BLUESKY_APP_PASSWORD="xxxx-xxxx-xxxx-xxxx"
    ```

    > **Note:** App Passwords can be created in your Bluesky Settings under "App passwords". They are safer than using your main password. Mastodon fetching is done via public, unauthenticated APIs and requires no credentials.

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
3.  **Add Environment Variables:** In the Vercel project settings, navigate to "Environment Variables" and add your `BLUESKY_HANDLE` and `BLUESKY_APP_PASSWORD`.
4.  **Deploy:** Click the "Deploy" button. Vercel will build and deploy your application.

## License

This project is licensed under the Apache 2.0 License. See the [LICENSE](https://www.apache.org/licenses/LICENSE-2.0) file for details.