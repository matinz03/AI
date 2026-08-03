"use client";

import { useEffect, useState } from "react";

const Arrow = () => <span aria-hidden="true" className="arrow">↗</span>;

export default function Home() {
  const [active, setActive] = useState("home");

  useEffect(() => {
    const sections = [...document.querySelectorAll<HTMLElement>("section[id]")];
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.find((entry) => entry.isIntersecting);
        if (visible) setActive(visible.target.id);
      },
      { rootMargin: "-38% 0px -54%" },
    );
    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, []);

  return (
    <main>
      <nav className="nav" aria-label="Main navigation">
        <a className="brand" href="#home" aria-label="Matin Zomorrodabedi, home">
          <span className="brand-mark">MZ</span>
          <span>MATIN Z.</span>
        </a>
        <div className="nav-links">
          {[
            ["home", "Home"],
            ["about", "Profile"],
            ["journey", "Journey"],
            ["portfolio", "Work"],
          ].map(([id, label]) => (
            <a key={id} className={active === id ? "active" : ""} href={`#${id}`}>{label}</a>
          ))}
        </div>
        <a className="nav-contact" href="mailto:matzbusiness1@gmail.com">Let&apos;s talk <Arrow /></a>
      </nav>

      <section id="home" className="hero section-shell">
        <div className="hero-copy reveal">
          <p className="eyebrow"><span className="signal" /> AVAILABLE FOR COLLABORATION</p>
          <h1>Digital systems,<br /><em>built with intent.</em></h1>
          <p className="lede">Full stack developer turning complex requirements into crisp, durable product experiences.</p>
          <div className="hero-actions">
            <a className="button button-primary" href="#portfolio">Explore my work <Arrow /></a>
            <a className="text-link" href="#journey">Scroll to journey <span>↓</span></a>
          </div>
        </div>
        <div className="hero-art" aria-label="Abstract digital composition">
          <div className="orb orb-one" />
          <div className="orb orb-two" />
          <div className="grid-panel">
            <span className="panel-label">SYSTEM / 01</span>
            <div className="line line-a" /><div className="line line-b" /><div className="line line-c" />
            <div className="art-number">01</div>
            <div className="point point-a" /><div className="point point-b" />
          </div>
          <p className="art-caption">Engineering<br />for clarity.</p>
        </div>
        <div className="scroll-index">01 / 04</div>
      </section>

      <section id="about" className="about section-shell">
        <div className="section-kicker"><span>01</span> PROFILE</div>
        <div className="about-grid">
          <div className="statement reveal">
            <p>I build interfaces that feel <em>inevitable</em> — clear for people, robust for teams, and ready to scale.</p>
          </div>
          <div className="about-detail reveal delay">
            <p>I&apos;m Matin, a full stack developer and Computer Engineering student based in Italy. My work sits at the intersection of thoughtful UX and production-grade architecture.</p>
            <p>From front-end systems to API integrations, I enjoy reducing complexity into focused, performant digital products.</p>
            <a className="text-link" href="mailto:matzbusiness1@gmail.com">Start a conversation <Arrow /></a>
          </div>
        </div>
        <div className="capabilities">
          <div><span>01</span><h3>Interface<br />architecture</h3><p>Component systems built for consistency, velocity, and care.</p></div>
          <div><span>02</span><h3>Product<br />engineering</h3><p>End-to-end features that connect the interface to real business logic.</p></div>
          <div><span>03</span><h3>Performance<br />craft</h3><p>Accessible, responsive experiences that feel as fast as they look.</p></div>
        </div>
      </section>

      <section id="journey" className="journey section-shell">
        <div className="journey-heading">
          <div className="section-kicker"><span>02</span> CAREER JOURNEY</div>
          <h2>Experience that<br /><em>keeps moving.</em></h2>
        </div>
        <div className="timeline">
          <article className="timeline-item current">
            <div className="timeline-date">2025 — NOW</div>
            <div className="timeline-role"><h3>Full Stack<br />Web Developer</h3><p>ACPV ARCHITECTS<br />Antonio Citterio Patricia Viel</p></div>
            <p className="timeline-copy">Contributing to the front-end architecture and design system for a leading architecture practice. Building scalable web interfaces and backend integrations alongside UX/UI and engineering teams.</p>
            <div className="tags"><span>ANGULAR</span><span>NODE.JS</span><span>GRAPHQL</span><span>MONGODB</span></div>
          </article>
          <article className="timeline-item">
            <div className="timeline-date">2025</div>
            <div className="timeline-role"><h3>Full Stack<br />Developer</h3><p>TEAM ISAAC · POLITO</p></div>
            <p className="timeline-copy">Reframed a student team&apos;s React platform with a component-first architecture. Integrated Directus CMS and React Query to make data management more reliable and fluid.</p>
            <div className="tags"><span>REACT</span><span>DIRECTUS</span><span>REACT QUERY</span></div>
          </article>
          <article className="timeline-item education">
            <div className="timeline-date">2022 —</div>
            <div className="timeline-role"><h3>Computer<br />Engineering</h3><p>POLITECNICO DI TORINO</p></div>
            <p className="timeline-copy">Undergraduate studies grounding product thinking in the fundamentals of computer science and systems design.</p>
            <div className="tags"><span>COMPUTER SCIENCE</span></div>
          </article>
        </div>
      </section>

      <section id="portfolio" className="portfolio section-shell">
        <div className="portfolio-top">
          <div className="section-kicker"><span>03</span> SELECTED WORK</div>
          <p>Portfolio <strong>in progress.</strong><br />The next case study is being shaped.</p>
        </div>
        <a className="portfolio-card" href="https://3-d-portofolio-theta.vercel.app" target="_blank" rel="noreferrer">
          <div className="card-meta"><span>FEATURED DESTINATION</span><span>OPEN <Arrow /></span></div>
          <div className="card-core"><span className="card-orbit orbit-x" /><span className="card-orbit orbit-y" /><span className="card-dot" /><h2>Beyond the<br /><em>interface.</em></h2></div>
          <div className="card-footer"><span>3D PORTFOLIO</span><span>EXPERIMENTAL / INTERACTIVE</span></div>
        </a>
        <div className="project-note">More selected projects and detailed case studies are coming soon.</div>
      </section>

      <footer className="footer section-shell">
        <div><p className="eyebrow"><span className="signal" /> NEXT OPPORTUNITY</p><h2>Let&apos;s make something<br /><em>that matters.</em></h2></div>
        <div className="footer-links">
          <a className="footer-email" href="mailto:matzbusiness1@gmail.com">matzbusiness1@gmail.com <Arrow /></a>
          <div><a href="https://www.linkedin.com/in/matin-zomorrodabedi" target="_blank" rel="noreferrer">LinkedIn</a><a href="https://github.com/matinz03" target="_blank" rel="noreferrer">GitHub</a></div>
        </div>
        <div className="footer-bottom"><span>© {new Date().getFullYear()} MATIN ZOMORRODABEDI</span><span>DESIGNED &amp; BUILT WITH INTENT</span></div>
      </footer>
    </main>
  );
}
