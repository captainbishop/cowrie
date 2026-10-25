"use client";
import { useRef, useState } from "react";
import styles from "./DemoVideo.module.css";

const demos = {
  product: {
    title: "Your money, in your own words.", label: "Cowrie product tour", duration: "3:04", kind: "Product tour",
    description: "Payments, savings and Ajo. See how a conversation becomes an action.",
    file: "cowrie-product-v1", note: "Recorded with test money · English captions", anchor: "product-demo",
  },
  cre: {
    title: "An Ajo circle, from start to payout.", label: "Cowrie Ajo and Chainlink CRE walkthrough", duration: "2:51", kind: "Ajo automation",
    description: "Follow two members through the draw, automatic contributions and both payouts.",
    file: "cowrie-cre-v1", note: "Monad testnet · CRE simulation with broadcast", anchor: "cre-demo",
  },
};

export default function DemoVideo({ showPageLink = true, variant = "product", intro }: { showPageLink?: boolean; variant?: keyof typeof demos; intro?: string }) {
  const video = useRef<HTMLVideoElement>(null);
  const [started, setStarted] = useState(false);
  const [failed, setFailed] = useState(false);
  const demo = demos[variant];
  const source = `/demos/${demo.file}.mp4`;
  async function play() {
    try { await video.current?.play(); } catch { setFailed(true); }
  }
  return <section className={styles.card} aria-label={demo.label}>
    {intro && <p className={styles.intro}>{intro}</p>}
    <div className={styles.heading}>
      <div className={styles.meta}><span>{demo.kind}</span><span>{demo.duration}</span></div>
      <strong>{demo.title}</strong>
      {!intro && <p>{demo.description}</p>}
    </div>
    <div className={styles.screen}>
      <video ref={video} controls={started || failed} playsInline preload="none" width={1920} height={1080}
        poster={`/demos/${demo.file}.webp`} aria-label={demo.label}
        onPlay={() => { setStarted(true); setFailed(false); }} onError={() => setFailed(true)}>
        <source src={source} type="video/mp4" />
        Your browser cannot play this video.
      </video>
      {!started && !failed && <button type="button" className={styles.play} onClick={play} aria-label={`Play ${demo.label}`}>
        <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="m8 5 11 7-11 7Z" fill="currentColor" /></svg>Watch {demo.duration}
      </button>}
    </div>
    {failed && <p className={styles.error} role="status">The video could not play here. <a href={source}>Open the video</a>.</p>}
    <div className={styles.footer}>
      <span>{demo.note}</span>
      {showPageLink ? <a href={`/demo#${demo.anchor}`}>Full walkthrough <span aria-hidden="true">↗</span></a> : <a href={source} download>Download video</a>}
    </div>
  </section>;
}
