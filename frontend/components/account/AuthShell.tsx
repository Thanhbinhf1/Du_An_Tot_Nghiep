import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import styles from "@/app/auth.module.css";

export default function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div className={styles.page}>
      <div className={styles.shell}>
        <section className={styles.formPanel}>
          <div className={styles.form}>
            <Link className={styles.brand} href="/" aria-label="Trang chủ F.Style">
              <Image className={styles.logo} src="/logo-vcs.png" alt="F.Style" width={68} height={60} />
            </Link>
            {children}
          </div>
        </section>
        <aside className={styles.imagePanel} aria-hidden="true">
          <Image className={styles.coverImage} src="/images/auth/auth-fashion.png" alt="" fill
            sizes="(max-width: 790px) 1px, 50vw" />
          <div className={styles.imageCaption}>Phong cách của riêng bạn.</div>
        </aside>
      </div>
    </div>
  );
}
