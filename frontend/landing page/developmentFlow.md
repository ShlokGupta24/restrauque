The Development Flow: How it was built
When building a modern, animated web application, the flow generally follows this order: Structure & Styling Foundation ➔ Component Logic ➔ Page Assembly ➔ Animations & Polish.

First Step: Design System & Styling (landing.css) Before touching any React code, I established the visual foundation in landing.css. I started by defining CSS variables (:root { --red: #e53935; ... }) for the color palette to ensure consistency. Then, I built out the responsive utility classes (like .wrap for centering content), typography, and button styles. This ensured that when I built the HTML, the styles were ready to apply instantly.

Second Step: Core Layout & Navigation (LandingPage.tsx) I created the LandingPage.tsx file and built the outer shell of the site (<div className="site-shell">). The very first component built was the <header>, implementing the brand logo, navigation links, and the mobile hamburger menu toggle.

Third Step: The Hero Section The hero is the first thing users see. I built the complex visual layout containing the background image (cafeScene), the overlay gradient vignette, the animated text ("AI-native intelligence"), and the quick statistics at the bottom.

Fourth Step: Content Sections I then built the page downward, section by section:
The Meaning Section (the mist background with "Turn every meal...").
The Layers Section (Capture, Understand, Act) with custom UI mockups inside the cards.
The Features & Pricing grids to convey value.
Fifth Step: Interactivity & Modals I added the React state hooks (useState) to handle opening and closing the mobile menu and the "Watch How It Works" demo modal.
Final Step: GSAP Animations Once the static page looked beautiful, I brought it to life. I used GSAP (GreenSock Animation Platform) and ScrollTrigger to add entry animations to the hero text and scroll-based reveals for the cards as the user scrolls down the page.
Detailed Code Walkthrough (LandingPage.tsx)
Here is an explanation of the core blocks of code and what they do in the file:

1. Imports and Setup
tsx
import { useEffect, useRef, useState } from 'react';
import { ArrowRight, ArrowUpRight, BarChart3, Check, ... } from 'lucide-react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';
// ... asset imports ...
import '../../styles/landing.css';
gsap.registerPlugin(ScrollTrigger, useGSAP);
React Hooks: useState (for toggles), useRef (to target DOM elements for animation), useEffect (for side-effects).
Icons: We import specific SVG icons from lucide-react to use in buttons and feature cards.
GSAP: We import the animation library and its scroll plugin, then register them so they work globally.
2. The Features Data Array
tsx
const features = [
  { icon: QrCode, title: 'QR ordering', text: 'A frictionless menu...' },
  // ...
];
Instead of hardcoding every feature card in the HTML, we store the data in an array. Later in the JSX, we .map() over this array to dynamically render the cards. This keeps the code clean.
3. Component Initialization & State
tsx
export default function LandingPage() {
  const root = useRef<HTMLDivElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [showDemo, setShowDemo] = useState(false);
root: A reference attached to the outermost <div>. GSAP uses this to scope animations only to this page.
menuOpen: A boolean state that tracks if the mobile navigation is visible.
showDemo: A boolean state that tracks if the "Watch How It Works" popup modal is open.
4. The Animation Logic (GSAP)
tsx
useGSAP(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    
    // 1. Initial Page Load Animation
    const intro = gsap.timeline({ defaults: { ease: 'power3.out' } });
    intro.from('.nav-inner', { y: -22, opacity: 0, duration: 0.75 })
         .from('.hero-eyebrow', { ... }) // Chained animations for the hero text
    // 2. Scroll-based Animations
    gsap.to('.scene-image', { 
        yPercent: 9, scale: 1.08, 
        scrollTrigger: { trigger: '.hero', scrub: 1 } 
    });
    // ... more scroll triggers ...
  }, { scope: root });
Accessibility Check: prefers-reduced-motion ensures we don't play animations for users who have disabled them in their OS.
Timelines (gsap.timeline): This chains animations together so the navbar fades in, then the eyebrow text, then the main title line by line.
ScrollTriggers (scrollTrigger): These rules tie animations to the user's scrollbar. As you scroll down the .hero section, the .scene-image moves and scales slightly, creating a parallax effect.
5. Scroll Locking (useEffect)
tsx
useEffect(() => {
    document.body.style.overflow = menuOpen || showDemo ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [menuOpen, showDemo]);
Whenever the user opens the mobile menu or the demo modal, we set the body's CSS overflow to hidden. This prevents the user from accidentally scrolling the background page while looking at the popup.
6. The JSX Structure (The Visuals)
The return statement dictates the actual HTML rendered to the browser.

<header>: Contains the logo, navigation links, and login buttons. It dynamically applies an .is-open CSS class if menuOpen is true.
<section className="hero">: The top section. It contains the background vignette layers, the large <h1> title, and the primary call-to-action buttons.
<section className="layers-section">: The meat of the page. Contains three massive <article className="layer-card"> elements. Each card is hardcoded to show a custom mini-UI (like the mock menu layout, the mock revenue chart, and the mock AI agent notification).
<section className="features-section">: Uses {features.map(...)} to loop through the array we defined at the top and render out small, hoverable feature cards.
Demo Modal at the bottom:
tsx
{showDemo && <div className="modal-backdrop">...</div>}
This conditionally renders the popup only when the user clicks the "Watch How It Works" button. It includes a dark backdrop and the modal content.
Summary
The page relies heavily on modern CSS (flexbox, grid, gradients) in landing.css for structure and beauty, while LandingPage.tsx acts as the orchestrator—handling data looping, state management for popups, and scroll-bound animations to create a premium, dynamic feel.