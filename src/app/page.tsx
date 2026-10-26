import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { Closing } from "@/components/landing/Closing";
import { Commands } from "@/components/landing/Commands";
import { Hero } from "@/components/landing/Hero";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { Motion } from "@/components/landing/Motion";
import { Proof } from "@/components/landing/Proof";
import { Switch } from "@/components/landing/Switch";
import styles from "@/components/landing/landing.module.css";

// Sets data-js on the page wrapper before first paint. The hidden start states
// for entrances exist only under [data-js], so without JavaScript everything
// is simply visible.
const JS_FLAG =
  "document.currentScript.parentElement.setAttribute('data-js','')";

export default function Home() {
  return (
    <div className={styles.page} suppressHydrationWarning>
      <script dangerouslySetInnerHTML={{ __html: JS_FLAG }} />
      <Motion />
      <SiteHeader />
      <Hero />
      <Proof />
      <Switch />
      <HowItWorks />
      <Commands />
      <Closing />
      <SiteFooter />
    </div>
  );
}
