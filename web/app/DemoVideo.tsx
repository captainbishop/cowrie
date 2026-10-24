"use client";
import { useRef, useState } from "react";
import styles from "./DemoVideo.module.css";

const demos = {
  product: {
    title: "See Cowrie in action", label: "Cowrie product tour", duration: "3:04 · English captions",
    file: "cowrie-product-v1", note: "Recorded with test money.", anchor: "product-demo",
  },
  cre: {
    title: "Ajo, powered by Chainlink CRE", label: "Cowrie Ajo and Chainlink CRE walkthrough", duration: "2:51 · On-chain walkthrough",
    file: "cowrie-cre-v1", note: "Monad testnet · CRE simulation with broadcast.", anchor: "cre-demo",
  },
};

export default function DemoVideo({ showPageLink = true, variant = "product" }: { showPageLink?: boolean; variant?: keyof typeof demos }) {
  const video = useRef<HTMLVideoElement>(null);
  const [started, setStarted] = useState(false);
  const [failed, setFailed] = useState(false);
  const demo = demos[variant];
  const source = `/demos/${demo.file}.mp4`;
  async function play() {
    try { await video.current?.play(); } catch { setFailed(true); }
  }
  return <section className={styles.card} aria-label={demo.label}>
    <div className={styles.heading}><strong>{demo.title}</strong><span>{demo.duration}</span></div>
    <div className={styles.screen}>
      <video ref={video} controls playsInline preload="none" width={1920} height={1080}
        poster={`/demos/${demo.file}.webp`} aria-label={demo.label}
        onPlay={() => { setStarted(true); setFailed(false); }} onError={() => setFailed(true)}>
        <source src={source} type="video/mp4" />
        Your browser cannot play this video.
      </video>
      {!started && !failed && <button type="button" className={styles.play} onClick={play} aria-label={`Play ${demo.label}`}>
        <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="m8 5 11 7-11 7Z" fill="currentColor" /></svg>Play demo
      </button>}
    </div>
    {failed && <p className={styles.error} role="status">The video could not play here. <a href={source}>Open the video</a>.</p>}
    <div className={styles.footer}>
      <span>{demo.note}</span>
      {showPageLink && <a href={`/demo#${demo.anchor}`}>Open demo page</a>}
      {showPageLink && variant === "product" && <a href="/demo#cre-demo">Watch Ajo automation</a>}
      <a href={source} download>Download</a>
    </div>
  </section>;
}
