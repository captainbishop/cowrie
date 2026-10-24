import type { Metadata } from "next";
import DemoVideo from "../DemoVideo";
import transcript from "./product-transcript.json";
import creTranscript from "./cre-transcript.json";
import styles from "./demo.module.css";

export const metadata: Metadata = {
  title: "Watch Cowrie in action",
  description: "Explore Cowrie through a product tour, then see Chainlink CRE coordinate an Ajo circle from contributions to payouts.",
};

export default function DemoPage() {
  return (
    <main className={styles.page}>
      <nav className={styles.nav} aria-label="Demo navigation">
        <a className={styles.wordmark} href="/">Cowrie</a>
        <a className={styles.back} href="/">Open the app <span aria-hidden="true">↗</span></a>
      </nav>
      <header className={styles.heading}>
        <p className={styles.eyebrow}>A closer look</p>
        <h1>See Cowrie in action.</h1>
        <p>Explore everyday money through conversation, then see the Chainlink CRE workflow behind Ajo.</p>
      </header>
      <nav className={styles.choices} aria-label="Choose a walkthrough">
        <a href="#product-demo">The product tour</a>
        <a href="#cre-demo">Ajo automation</a>
      </nav>
      <section id="product-demo" className={styles.walkthrough} aria-labelledby="product-title">
        <div className={styles.sectionHeading}><span>01</span><h2 id="product-title">Your money, in your own words.</h2></div>
        <div className={styles.film}><DemoVideo showPageLink={false} /></div>
        <details id="demo-transcript" className={styles.transcript}>
          <summary>Read the product transcript</summary>
          {transcript.map((section) => <section key={section.title}><h3>{section.title}</h3><p>{section.text}</p></section>)}
        </details>
      </section>
      <section id="cre-demo" className={styles.walkthrough} aria-labelledby="cre-title">
        <div className={styles.sectionHeading}><span>02</span><h2 id="cre-title">Watch the circle move.</h2></div>
        <p className={styles.sectionIntro}>Two members. Two rounds. Follow the app and the CRE terminal through the draw, automatic contributions, and both payouts.</p>
        <div className={styles.film}><DemoVideo variant="cre" showPageLink={false} /></div>
        <details className={styles.transcript}>
          <summary>Read the CRE walkthrough</summary>
          {creTranscript.map((section) => <section key={section.title}><h3>{section.title}</h3><p>{section.text}</p></section>)}
        </details>
      </section>
    </main>
  );
}
