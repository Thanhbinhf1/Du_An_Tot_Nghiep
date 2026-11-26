import type { ReactNode } from "react";
import styles from "@/app/auth.module.css";

export default function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div className={styles.page}>
      <section className={styles.form}>{children}</section>
    </div>
  );
}
