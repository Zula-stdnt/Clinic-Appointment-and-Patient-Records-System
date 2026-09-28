# Next.js: App Router Basics

## Related Lessons

- [[05 Next.js/nextjs_introduction_and_setup]]
- [[05 Next.js/nextjs_components_and_jsx]]
- [[03 APIs and Database Operations/javascript_working_with_apis]]

## 1. Lesson Summary

### Main Idea

Routing in Next.js dictates how users navigate from one page to another. Unlike traditional React where you use an external library like React Router, Next.js uses a **File-System Based Router**. This means the folders you create inside the `app/` directory automatically become the URLs for your application.

### 1. Defining Routes

To create a new route (like `/about` or `/blogs`), you simply create a folder with that exact name inside the `app/` directory. 

However, a folder alone doesn't show anything on the screen. To make a route visible, you must place a file named **`page.js`** inside that folder.

* `app/page.js` -> Home Page (`/`)
* `app/about/page.js` -> About Page (`/about`)
* `app/blogs/page.js` -> Blogs Page (`/blogs`)

### 2. The Link Component

For internal route navigation, Next.js provides the built-in `<Link>` component, which supports client-side transitions and route prefetching. Native `<a>` elements remain appropriate for external URLs, downloads, and cases that need a regular browser navigation.

### 3. Custom 404 (Not Found) Pages

For an unmatched route, Next.js displays its not-found UI. Add `app/not-found.js` to customize that UI; the `notFound()` function can also render the nearest not-found boundary for a missing resource.

## 2. Coding Writing Style

The App Router uses folders and special filenames to define routes. Component naming and function syntax are React conventions rather than routing requirements.

### Directory-Based Routing Convention

**How to structure it:** A folder segment contributes to the URL path, and a `page.js` file makes that segment routable. Lowercase route names are a common convention. Exported React component names conventionally use PascalCase.

```
app/
 ├── contact/          <-- Lowercase folder name (URL path)
 │    └── page.js      <-- Standardized file name required by Next.js
 └── not-found.js      <-- Standardized file name for 404 errors
```

### Functional Component Structure

**One common style:** Use a function component and export it as the page. Arrow functions are also valid. Modern JSX transforms generally do not require importing `React` just to use JSX.

```javascript
// app/contact/page.js

const Contact = () => {  // Component name is PascalCase
  return (
    <h1>Contact Us Page</h1>
  );
};

export default Contact;
```

### Navigation Using `<Link>`

**For internal routes:** Import `Link` from `next/link` and set `href` to the route path, usually beginning with `/`.

```javascript
// app/page.js
import Link from 'next/link'; // 1. Always import the component

const Home = () => {
  return (
    <>
      <h1>Home Page</h1>
      {/* 2. Use <Link> instead of <a> tags */}
      <Link href="/about">About</Link>
      <Link href="/contact">Contact Us</Link>
      <Link href="/">Home</Link>
    </>
  );
};

export default Home;
```

### Custom Error Handling Structure

**How to write it:** To create a custom 404 page, you must create a file named exactly `not-found.js` at the top level of the `app` directory. Next.js will automatically detect it and render it when a route is missing.

```javascript
// app/not-found.js

const NotFound = () => {
  return (
    <h1>404 - Page Not Found</h1>
  );
};

export default NotFound;
```

## 3. Quick Review

### Important Syntax & File Names

```
import Link from 'next/link';
<Link href="/path">Click Here</Link>

Required UI File: page.js
Required 404 File: not-found.js
```

### Core Idea

**Next.js routing is driven by the file system: folders inside the `app/` directory define the URL paths, and `page.js` files define the UI. Seamless navigation is achieved using the `<Link>` component.**