# Next.js: Starting to Code

## Related Lessons

- [[05 Next.js/nextjs_introduction_and_setup]]
- [[05 Next.js/nextjs_app_router_basics]]
- [[01 JavaScript Foundations/javascript_modules]]

## 1. Lesson Summary

### Main Idea

In an App Router project, route UI and layouts are organized in `app/`, while `public/` holds static assets served from the site root. Next.js can also use the Pages Router. JSX lets JavaScript expressions and markup describe a component's UI.

### 1. Project File Structure

* **`app/` Folder:** The core of your application. `page.js` is the entry point (the actual UI rendered on the screen). `layout.js` acts as the structural wrapper. 
* **`public/` Folder:** Used strictly for static assets like images, audio, or fonts.
* **Project Files:** `package.json` contains project scripts and dependency declarations. Use the package manager when changing dependencies; do not edit installed files inside `node_modules`.

### 2. JavaScript XML (JSX)

JSX allows you to write HTML tags directly inside your JavaScript code. 

* **The Single Parent Rule:** A JSX `return` statement cannot return multiple sibling elements. They must be wrapped in a single parent container. 
* **Fragments:** To avoid adding unnecessary `<div>` tags to your DOM, you can wrap sibling elements in an empty tag called a **Fragment** (`<> ... </>`).

### 3. Importing Next.js Components

Next.js provides an optimized `<Image />` component, but a native `<img>` can still be appropriate. Choose based on the needs of the image and project. For a public asset, use a root-relative path such as `/images/photo.jpg`, not `/public/images/photo.jpg`.

* For a remote image, configure allowed hosts when using the default optimizer. The `Image` component requires `alt` text and generally needs `width` and `height`, unless the image is statically imported or uses `fill`.

### 4. Custom CSS Integration

Use `className` rather than the HTML `class` attribute in JSX. Global CSS is typically imported from the root layout; CSS Modules can be imported by components.

## 2. Coding Writing Style

Functional components are a common way to build pages and UI in Next.js. Arrow functions are one valid style; function declarations are also supported.

### Functional Component Structure

**One common pattern:** Define a component with an arrow function, put any local calculations before the returned JSX, and export it as the route component.

```javascript
// 1. Imports at the top
import Image from 'next/image';
import './style.css';

// 2. Define the component using an Arrow Function
const Home = () => {
  
  // 3. Standard JavaScript logic goes HERE (before the return)
  const greeting = "Hello Next.js!";

  // 4. Return JSX (Must have a single parent element or Fragment)
  return (
    <>
      <h1 className="red-color">{greeting}</h1>
      <p>Please be good to me.</p>
      
      {/* Asset paths start with a forward slash (points to public/) */}
      <Image 
        src="/assets/images/stud.jpeg" 
        alt="Student image" 
        width={200} 
        height={300} 
      />
    </>
  );
}

// 5. Export the component
export default Home;
```

### Key Syntax Rules to Remember

* **`className` over `class`:** Always use `className="my-css-class"` in JSX.
* **Fragments (`<> </>`):** Use these when you need to return multiple adjacent HTML elements without breaking the layout with extra divs.
* **Public Asset Paths:** A path such as `src="/image.png"` addresses `public/image.png`. A remote `Image` source may also require an allowlisted host and explicit dimensions.

## 3. Quick Review

### Important Syntax

```javascript
import ComponentName from 'library';
const MyPage = () => { ... return (<> ... </>); }
export default MyPage;
```

### Core Idea

**Next.js pages return JSX from React components. Use the App Router or Pages Router conventions for the project, and choose Server or Client Components based on whether the UI needs browser-side interactivity.**