"use client";

import { ArrowUpRight, BookOpen, HeartHandshake, Lightbulb } from "lucide-react";
import styles from "./learning-launchpad.module.css";

export default function LearningLaunchpad({ role }: { role: string }) {
  if (!["teacher", "student", "administrator"].includes(role)) return null;
  const student = role === "student";
  return <section className={styles.launchpad} aria-label="Teaching and learning tools">
    <a href={student ? "/portal/resources" : "/portal/ilaw"} className={styles.primaryCard}>
      <div className={styles.cardTop}><span className={styles.icon}>{student ? <BookOpen size={22}/> : <Lightbulb size={22}/>}</span><span className={styles.tag}>{student ? "EXPLORE" : "PLAN"}</span><ArrowUpRight size={18}/></div>
      <h3>{student ? "Your next lesson starts here." : "Good lessons begin with a clear plan."}</h3>
      <p>{student ? "Open your class modules, activity sheets, reviewers, and teacher-selected links." : "Organize your ideas, activities, and assessment with the ILAW lesson plan generator."}</p>
      <span className={styles.action}>{student ? "Open learning resources" : "Create an ILAW lesson plan"}<ArrowUpRight size={15}/></span>
    </a>
    <a href="/portal/aral" className={styles.supportCard}>
      <div className={styles.cardTop}><span className={styles.icon}><HeartHandshake size={22}/></span><span className={styles.tag}>SUPPORT</span><ArrowUpRight size={18}/></div>
      <h3>{student ? "You can always ask for help." : "A little support. A meaningful next step."}</h3>
      <p>{student ? "Find activities from your ARAL tutor, revisit feedback, and let them know where you need help." : role === "administrator" ? "Connect learners with tutors and follow their ARAL activities and progress." : "Prepare activities and give useful feedback to learners assigned to you as ARAL tutor."}</p>
      <span className={styles.action}>Open ARAL support<ArrowUpRight size={15}/></span>
    </a>
  </section>;
}

