import { useRef } from "react";
import { Link } from "react-router-dom";
import { Bell, BriefcaseBusiness, ChartNoAxesCombined, ClipboardList, LayoutDashboard, Monitor, ShieldCheck, UserRound, UsersRound, X } from "lucide-react";
import { googleLoginUrl } from "@/api/client";
import lvLogo from "@/assets/lv-logo-sidebar.webp";
import googleIcon from "@/assets/google_icon.png";
import StudentDashboardPreview from "./landing/StudentDashboardPreview";
import "./LandingPage.css";

const features = [
  { icon: UsersRound, title: "Role-Based Accounts", description: "Distinct login credentials and permissions for the Administrator, Program Head, Instructor, and Student, each restricted to the data relevant to that role." },
  { icon: ClipboardList, title: "Request Submission", description: "A digital interface allowing students to submit excuse letters and late reports." },
  { icon: LayoutDashboard, title: "Scoped Dashboards", description: "A consolidated view for the administrator, a program-level view for the program head, and a subject-level view for the instructor." },
  { icon: Bell, title: "Automated Notifications", description: "Stay informed about submitted requests, instructor decisions, and attendance updates." },
  { icon: ChartNoAxesCombined, title: "Absenteeism Threshold Tracking", description: "Monitor attendance against the system’s thresholds, with warnings as recorded absences and tardiness approach the policy limits." },
];
const roles = [
  { icon: UserRound, title: "Student", description: "Submit and track requests" },
  { icon: Monitor, title: "Instructor", description: "Review and record" },
  { icon: BriefcaseBusiness, title: "Program Head", description: "Monitor the program" },
  { icon: ShieldCheck, title: "Admin", description: "Oversee the college" },
];
const steps = [
  { title: "Direct Submission", description: "Sign in with your school account, fill out the form, and attach evidence." },
  { title: "Automatic Routing", description: "The system matches your subject and sends it straight to the instructor." },
  { title: "Threshold Tracking", description: "Recorded absences and lates are checked against attendance policy thresholds." },
  { title: "Instructor Review", description: "Your instructor reviews the request and records a decision." },
  { title: "Stay Updated", description: "Track your request status and receive updates in your dashboard." },
];

function SectionHeading({ title, children }) {
  return <div className="landing-section-heading"><h2>{title}</h2><p>{children}</p></div>;
}

export default function LandingPage() {
  const privacy = useRef(null);
  const policy = useRef(null);
  return <div className="landing-page">
    <a className="landing-skip" href="#main-content">Skip to content</a>
    <header className="landing-header">
      <div className="landing-container landing-nav">
        <a href="#main-content" className="landing-brand" aria-label="ALRM System home"><img src={lvLogo} alt="La Verdad Christian College logo" width="48" height="48" />ALRM System</a>
        <nav aria-label="Main navigation">
          <a href="#features">Features</a><a href="#roles">Roles</a><a href="#how-it-works">How it works</a><a href="#departments">Departments</a>
        </nav>
        <Link className="landing-sign-in" to="/login">Sign In</Link>
      </div>
    </header>
    <main id="main-content" tabIndex={-1}>
      <section className="landing-hero" aria-labelledby="landing-title">
        <div className="landing-container landing-hero-grid">
          <div className="landing-hero-copy">
            <p className="landing-eyebrow">La Verdad Christian College</p>
            <h1 id="landing-title">Absence and late reports,<br />handled online.</h1>
            <p className="landing-intro">Submit excuse letters and late reports, get routed to the right instructor automatically, and stay ahead of absenteeism thresholds.</p>
            <button type="button" className="landing-google" onClick={() => { window.location.href = googleLoginUrl(); }}><img src={googleIcon} alt="" />Sign in with Google</button>
            <p className="landing-account-hint">Use your official LV email account</p>
          </div>
          <div className="landing-hero-visual">
            <div className="landing-shapes" aria-hidden="true"><i /><i /><i /><i /></div>
            <StudentDashboardPreview />
          </div>
        </div>
      </section>

      <section id="features" className="landing-section landing-container" aria-labelledby="features-title">
        <div id="features-title"><SectionHeading title="Key features">Everything you need to manage absences and tardiness</SectionHeading></div>
        <div className="landing-features">
          {features.map(({ icon: Icon, title, description }) => <article className="landing-feature" key={title}><span className="landing-feature-icon"><Icon size={24} aria-hidden="true" /></span><h3>{title}</h3><p>{description}</p></article>)}
        </div>
      </section>

      <section id="roles" className="landing-section landing-tinted" aria-labelledby="roles-title">
        <div className="landing-container"><div id="roles-title"><SectionHeading title="Built for every role">One system, four views</SectionHeading></div>
          <div className="landing-roles">{roles.map(({ icon: Icon, title, description }) => <article key={title}><span className="landing-role-icon"><Icon size={26} aria-hidden="true" /></span><h3>{title}</h3><p>{description}</p></article>)}</div>
        </div>
      </section>

      <section id="how-it-works" className="landing-section landing-container" aria-labelledby="workflow-title">
        <div id="workflow-title"><SectionHeading title="How it works">From submission to review in five steps</SectionHeading></div>
        <ol className="landing-steps">{steps.map(({ title, description }, index) => <li key={title}><span className="landing-step-number">{index + 1}</span><h3>{title}</h3><p>{description}</p></li>)}</ol>
      </section>

      <section id="departments" className="landing-section landing-tinted landing-departments" aria-labelledby="departments-title">
        <div className="landing-container"><div id="departments-title"><SectionHeading title="Departments served">Higher Education Department</SectionHeading></div>
          <ul className="landing-department-list" aria-label="Programs served">{["BSIS / ACT", "BSA / BSAIS", "BAB", "DSSW"].map((program) => <li key={program}>{program}</li>)}</ul>
        </div>
      </section>
    </main>
    <footer className="landing-footer">
      <div className="landing-container landing-footer-content">
        <div className="landing-school"><img src={lvLogo} alt="La Verdad Christian College logo" width="48" height="48" /><div><p>La Verdad Christian College</p><span>Higher Education Department · <a href="mailto:dpo@laverdad.edu.ph">dpo@laverdad.edu.ph</a></span></div></div>
        <nav aria-label="Privacy information"><button type="button" onClick={() => policy.current.showModal()}>Privacy Policy</button><button type="button" onClick={() => privacy.current.showModal()}>Data Privacy Notice</button></nav>
      </div>
    </footer>
    <dialog ref={policy} className="landing-dialog" aria-labelledby="policy-title" onClick={(event) => { if (event.target === event.currentTarget) event.currentTarget.close(); }}>
      <form method="dialog"><button className="landing-dialog-close" aria-label="Close privacy policy"><X size={20} /></button></form>
      <h2 id="policy-title">Privacy Policy</h2>
      <p>Access to student records in ALRM is restricted by account role. Sign in with your official LV account to access the information available to you.</p>
      <p>The dashboard on this public page is an anonymous preview. It does not display personal student records.</p>
      <p>For the college’s privacy policy and inquiries about your information, contact the Data Protection Officer at <a href="mailto:dpo@laverdad.edu.ph">dpo@laverdad.edu.ph</a>.</p>
    </dialog>
    <dialog ref={privacy} className="landing-dialog" aria-labelledby="privacy-title" onClick={(event) => { if (event.target === event.currentTarget) event.currentTarget.close(); }}>
      <form method="dialog"><button className="landing-dialog-close" aria-label="Close data privacy notice"><X size={20} /></button></form>
      <h2 id="privacy-title">Data Privacy Notice</h2>
      <p>The Higher Education Department collects, uses, stores, and processes personal information submitted through the request form for documentation and attendance tracking purposes.</p>
      <p>You can read the full notice and provide consent in the request form before submitting your information.</p>
      <p>For privacy inquiries, contact the Data Protection Officer at <a href="mailto:dpo@laverdad.edu.ph">dpo@laverdad.edu.ph</a>.</p>
    </dialog>
  </div>;
}
