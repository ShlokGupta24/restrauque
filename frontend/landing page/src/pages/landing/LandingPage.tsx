import { useEffect, useRef, useState } from 'react';
import { ArrowRight, ArrowUpRight, BarChart3, Check, CirclePlay, Menu, QrCode, Sparkles, TrendingUp, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';
import cafeScene from '../../assets/images/Restrauque Café QR Ordering Experience.png';
import mountainMist from '../../assets/images/mountain-mist.webp';
import '../../styles/landing.css';

gsap.registerPlugin(ScrollTrigger, useGSAP);

const features = [
  { icon: QrCode, title: 'QR ordering', text: 'A frictionless menu and ordering experience, right in the customer’s browser.' },
  { icon: BarChart3, title: 'Live operations', text: 'Bring orders, products, tables and daily performance into one clear view.' },
  { icon: TrendingUp, title: 'Product intelligence', text: 'Understand what sells, what is changing, and what deserves attention.' },
  { icon: Sparkles, title: 'AI that acts', text: 'Turn evidence-backed insights into recommendations your team can review.' },
];

export default function LandingPage() {
  const root = useRef<HTMLDivElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [showDemo, setShowDemo] = useState(false);

  useGSAP(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const intro = gsap.timeline({ defaults: { ease: 'power3.out' } });
    intro.from('.nav-inner', { y: -22, opacity: 0, duration: 0.75 })
      .from('.hero-eyebrow', { y: 16, opacity: 0, duration: 0.5 }, '-=0.35')
      .from('.hero-title-line', { yPercent: 110, opacity: 0, duration: 0.85, stagger: 0.11 }, '-=0.15')
      .from('.hero-copy, .hero-actions, .hero-stats', { y: 22, opacity: 0, duration: 0.65, stagger: 0.12 }, '-=0.35');

    gsap.to('.scene-image', { yPercent: 9, scale: 1.08, ease: 'none', scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: 1 } });
    gsap.to('.scene-glow', { y: 120, ease: 'none', scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: 1.2 } });
    gsap.to('.hero-content', { y: -65, opacity: 0.25, ease: 'none', scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: 1 } });
    gsap.from('.mist-image', { y: 90, ease: 'none', scrollTrigger: { trigger: '.meaning-section', start: 'top bottom', end: 'bottom top', scrub: 1 } });
    gsap.from('.meaning-copy > *', { y: 32, opacity: 0, duration: 0.8, stagger: 0.12, ease: 'power3.out', scrollTrigger: { trigger: '.meaning-copy', start: 'top 78%' } });
    gsap.from('.feature-card', { y: 38, opacity: 0, duration: 0.7, stagger: 0.12, ease: 'power3.out', scrollTrigger: { trigger: '.feature-grid', start: 'top 82%' } });
    gsap.from('.layer-card', { y: 34, opacity: 0, duration: 0.65, stagger: 0.14, ease: 'power3.out', scrollTrigger: { trigger: '.layers-grid', start: 'top 78%' } });


  }, { scope: root });

  useEffect(() => {
    document.body.style.overflow = menuOpen || showDemo ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [menuOpen, showDemo]);

  const closeMenu = () => setMenuOpen(false);
  const openDemo = () => setShowDemo(true);

  return (
    <div ref={root} className="site-shell">
      <header className="site-header">
        <div className="nav-inner wrap">
          <a className="brand" href="#top" aria-label="Restrauque home" onClick={closeMenu}>Restrauque<span>.</span></a>
          <nav className={`nav-links ${menuOpen ? 'is-open' : ''}`} aria-label="Main navigation">
            <a href="#product" onClick={closeMenu}>Product</a><a href="#solutions" onClick={closeMenu}>Solutions</a><a href="#intelligence" onClick={closeMenu}>Intelligence</a><a href="#agents" onClick={closeMenu}>AI Agents</a><a href="#pricing" onClick={closeMenu}>Pricing</a><a href="#about" onClick={closeMenu}>About</a>
            <div className="mobile-nav-actions"><Link className="button button-outline" to="/login/customer" onClick={closeMenu}>Customer Login</Link><Link className="button button-red" to="/login/restaurant" onClick={closeMenu}>Restaurant Login <ArrowRight size={16}/></Link></div>
          </nav>
          <div className="nav-actions"><Link className="button button-outline nav-customer" to="/login/customer">Customer Login</Link><Link className="button button-red nav-restaurant" to="/login/restaurant">Restaurant Login <ArrowRight size={16}/></Link></div>
          <button className="menu-toggle" aria-label={menuOpen ? 'Close menu' : 'Open menu'} aria-expanded={menuOpen} onClick={() => setMenuOpen(!menuOpen)}>{menuOpen ? <X/> : <Menu/>}</button>
        </div>
      </header>

      <main>
        <section className="hero" id="top">
          <div className="hero-scene" aria-hidden="true"><div className="scene-image" style={{ backgroundImage: `url(${cafeScene})` }} /><div className="scene-glow"/><div className="scene-vignette"/></div>
          <div className="wrap hero-layout">
            <div className="hero-content">
              <div className="hero-eyebrow"><span>CAPTURE</span><i/> <span>UNDERSTAND</span><i/> <span>ACT</span></div>
              <h1><span className="title-mask"><span className="hero-title-line">AI-native</span></span><span className="title-mask"><span className="hero-title-line">intelligence for</span></span><span className="title-mask"><span className="hero-title-line red-text">cafés &amp; restaurants.</span></span></h1>
              <p className="hero-copy">From QR ordering to AI agents — Restrauque connects your restaurant operations, customer data, and intelligence to help you grow faster.</p>
              <div className="hero-actions"><Link className="button button-red button-large" to="/get-started">Get Started <ArrowRight size={18}/></Link><button className="button button-glass button-large" onClick={openDemo}><CirclePlay size={19}/> Watch How It Works</button></div>
              <div className="hero-stats"><div><strong>500<span>+</span></strong><small>Restaurants</small></div><div><strong>2M<span>+</span></strong><small>Orders processed</small></div><div><strong>4.8<span>★</span></strong><small>Average rating</small></div></div>
            </div>

          </div>

          <div className="hero-bottom-fade"/>
        </section>

        <section className="meaning-section" id="about">
          <div className="mist-image" style={{ backgroundImage: `url(${mountainMist})` }} aria-hidden="true"/>
          <div className="meaning-copy" id="meaning"><p className="eyebrow dark-eyebrow">MORE THAN A MENU</p><h2>Turn every meal into<br/><span>meaningful data.</span></h2><p className="meaning-subtitle">Orders. Customers. Products. Insights. Actions.</p><div className="tiny-rule"/></div>
        </section>

        <section className="layers-section section-pad" id="product"><div className="wrap"><div className="section-heading"><p className="eyebrow">ONE CONNECTED PLATFORM</p><h2>From every order to<br/><span>your next best move.</span></h2><p>Capture the right signals, understand what they mean, and take action with confidence.</p></div>
          <div className="layers-grid" id="solutions">
            <article className="layer-card capture-card"><div className="layer-top"><span className="layer-number">01</span><span className="layer-icon"><QrCode size={20}/></span></div><p className="layer-kicker">CAPTURE</p><h3>Make every interaction count.</h3><p>QR menus, orders, payments, feedback and loyalty — connected in one operational flow.</p><div className="layer-tags"><span>QR menu</span><span>Orders</span><span>POS</span><span>Loyalty</span></div><div className="layer-visual menu-visual"><div className="menu-visual-head"><span className="mini-brand">The Urban Café<span>.</span></span><span className="open-pill">OPEN</span></div><div className="menu-item"><div className="food-dot coffee-dot">☕</div><div><b>Cold Coffee</b><small>Signature · 250 ml</small></div><strong>₹180</strong></div><div className="menu-item"><div className="food-dot pasta-dot">✦</div><div><b>Pasta Alfredo</b><small>Chef's special</small></div><strong>₹320</strong></div><div className="menu-total"><span>2 items in cart</span><b>₹500 <ArrowRight size={14}/></b></div></div></article>
            <article className="layer-card understand-card" id="intelligence"><div className="layer-top"><span className="layer-number">02</span><span className="layer-icon"><BarChart3 size={20}/></span></div><p className="layer-kicker">UNDERSTAND</p><h3>See the story behind sales.</h3><p>Turn scattered operational data into clear product, customer and business intelligence.</p><div className="layer-tags"><span>Analytics</span><span>Forecasts</span><span>Sentiment</span></div><div className="analytics-visual"><div className="analytics-title"><span>Weekly revenue</span><b>+18.6%</b></div><strong>₹1,84,650</strong><div className="chart-bars">{[35,49,41,65,52,76,62,91,72,100,82,95].map((height, i)=><i key={i} style={{height: `${height}%`}}/>)}</div><div className="chart-days"><span>MON</span><span>TUE</span><span>WED</span><span>THU</span><span>FRI</span><span>SAT</span><span>SUN</span></div></div></article>
            <article className="layer-card act-card" id="agents"><div className="layer-top"><span className="layer-number">03</span><span className="layer-icon"><Sparkles size={20}/></span></div><p className="layer-kicker">ACT</p><h3>Turn insight into momentum.</h3><p>AI agents help teams prioritize opportunities, recommend next steps and verify outcomes.</p><div className="layer-tags"><span>AI copilot</span><span>Agents</span><span>Approval</span></div><div className="agent-visual"><div className="agent-visual-head"><span className="agent-avatar"><Sparkles size={16}/></span><div><b>Growth opportunity</b><small>Product intelligence agent</small></div><span className="status-pill">READY</span></div><p>Cold Coffee is trending. Consider featuring it during Friday evening hours.</p><div className="agent-actions"><span><Check size={13}/> Evidence attached</span><button onClick={openDemo}>Review action <ArrowUpRight size={14}/></button></div></div></article>
          </div>
        </div></section>

        <section className="features-section section-pad"><div className="wrap"><div className="features-heading"><div><p className="eyebrow">BUILT FOR THE WAY RESTAURANTS WORK</p><h2>Less guesswork.<br/><span>More good decisions.</span></h2></div><p>One connected platform that supports daily operations today and smarter growth over time.</p></div><div className="feature-grid">{features.map(({icon: Icon,title,text}, index)=><article className="feature-card" key={title}><div className="feature-icon"><Icon size={21}/></div><span className="feature-index">0{index+1}</span><h3>{title}</h3><p>{text}</p><a href={index === 0 ? '#product' : index === 1 ? '#solutions' : index === 2 ? '#intelligence' : '#agents'} aria-label={`Explore ${title}`}>Explore <ArrowUpRight size={15}/></a></article>)}</div></div></section>

        <section className="pricing-section section-pad" id="pricing"><div className="wrap pricing-wrap"><div><p className="eyebrow">GROW AT YOUR OWN PACE</p><h2>Start with operations.<br/><span>Unlock intelligence.</span></h2><p className="pricing-intro">A modular platform that can grow with your restaurant — without needing three separate systems.</p></div><div className="pricing-options"><article><span className="pricing-num">01</span><div><h3>Operate</h3><p>QR ordering, digital menu and restaurant operations.</p></div><span className="pricing-cta">Talk to us <ArrowRight size={16}/></span></article><article><span className="pricing-num">02</span><div><h3>Intelligence</h3><p>Analytics, product and customer insights.</p></div><span className="pricing-cta">Talk to us <ArrowRight size={16}/></span></article><article><span className="pricing-num">03</span><div><h3>Autonomous</h3><p>AI agents and reviewed workflow automation.</p></div><span className="pricing-cta">Talk to us <ArrowRight size={16}/></span></article></div></div></section>

        <section className="final-cta"><div className="wrap final-cta-inner"><div><p className="eyebrow">YOUR NEXT CHAPTER STARTS HERE</p><h2>Turn your restaurant data<br/>into your next advantage.</h2></div><div className="final-cta-actions"><Link className="button button-white button-large" to="/get-started">Get Started <ArrowRight size={17}/></Link><a className="button button-glass button-large" href="mailto:hello@restrauque.com">Talk to Restrauque <ArrowUpRight size={16}/></a></div><div className="cta-orbit orbit-a"/><div className="cta-orbit orbit-b"/></div></section>
      </main>

      <footer className="footer"><div className="wrap"><div className="footer-main"><div className="footer-brand-col"><a className="brand" href="#top">Restrauque<span>.</span></a><p>Restaurant operations, intelligence<br/>and action — connected.</p></div><div className="footer-col"><b>Platform</b><a href="#product">Product</a><a href="#solutions">Solutions</a><a href="#intelligence">Intelligence</a><a href="#agents">AI Agents</a></div><div className="footer-col"><b>Explore</b><a href="#pricing">Packages</a><a href="#about">About</a><a href="mailto:hello@restrauque.com">Contact</a></div><div className="footer-col"><b>Access</b><Link to="/login/restaurant">Restaurant login</Link><Link to="/login/customer">Customer login</Link><Link to="/get-started">Get started</Link></div></div><div className="footer-bottom"><span>© {new Date().getFullYear()} Restrauque. All rights reserved.</span><span>Built for better restaurant decisions.</span></div></div></footer>

      {showDemo && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowDemo(false); }}><section className="demo-modal" role="dialog" aria-modal="true" aria-labelledby="demo-title"><button className="modal-close" aria-label="Close dialog" onClick={() => setShowDemo(false)}><X/></button><div className="modal-mark"><Sparkles size={24}/></div><p className="eyebrow">THE RESTR AUQUE FLOW</p><h2 id="demo-title">Capture. Understand. Act.</h2><p>One connected loop turns everyday restaurant activity into evidence-backed decisions.</p><ol><li><span>01</span><div><b>Capture</b><small>Orders, products, payments and feedback.</small></div></li><li><span>02</span><div><b>Understand</b><small>Analytics reveal trends and opportunities.</small></div></li><li><span>03</span><div><b>Act</b><small>Review recommendations and verify results.</small></div></li></ol><button className="button button-red button-large modal-done" onClick={() => setShowDemo(false)}>Got it <Check size={16}/></button></section></div>}
    </div>
  );
}
