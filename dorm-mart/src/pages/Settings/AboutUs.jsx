import { useState } from "react";
import SettingsLayout from "./SettingsLayout";
import sameerPhoto from "../../assets/team/sameer-jain.png";
import anishPhoto from "../../assets/team/anish-banerjee.png";
import chrisPhoto from "../../assets/team/chris-kim.png";

const developers = [
  {
    name: "Sameer Jain",
    title: "Feature Maker",
    email: "sameerjain501@gmail.com",
    github: "https://github.com/SameerJain",
    linkedin: "https://www.linkedin.com/in/sameer-jain1/",
    photo: sameerPhoto,
    contribution:
      "Built the login and account-security system, including password reset, two-factor authentication, CSRF protection, and defenses against XSS, SQL injection, and brute-force attempts. Added the seller dashboard, scheduled and ongoing purchases with chat integration, the wishlist and ratings system, message reporting with profanity filtering, and the Railway deployment with a custom domain and transactional email.",
  },
  {
    name: "Anish Banerjee",
    title: "Backend Builder",
    email: "anishbancse312@gmail.com",
    github: "https://github.com/anishcse312",
    linkedin: "https://www.linkedin.com/in/anish-banerjee-71aba9290/",
    photo: anishPhoto,
    contribution:
      "Set up the project's original database connection and built account creation, password changes, and product listing and search from the ground up. Added the dark mode theme, the home feed, the view-product and receipt pages, the purchase history and confirm-purchase APIs, and the private and public profile pages with negotiated-price support.",
  },
  {
    name: "Chris Kim",
    title: "DevOps King",
    email: "sooseokkim99@gmail.com",
    github: "https://github.com/chris-sooseok",
    linkedin: "https://www.linkedin.com/in/kim-chris-sooseok/",
    photo: chrisPhoto,
    contribution:
      "Built the purchase history page and the chat system from the ground up, including the real-time messaging backend, unread-message notifications, image uploads, and chat deletion. Added wishlist increment and notification tracking, a year filter on purchase history, redesigned the navbar and settings menu for mobile, and built the FAQ pages.",
  },
];

function EmailIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className="h-4 w-4 shrink-0"
      aria-hidden="true"
    >
      <path d="M1.5 6.75A2.25 2.25 0 0 1 3.75 4.5h16.5a2.25 2.25 0 0 1 2.25 2.25v10.5a2.25 2.25 0 0 1-2.25 2.25H3.75a2.25 2.25 0 0 1-2.25-2.25V6.75Zm2.4-.75 8.1 6.075L20.1 6h-16.2Zm16.85 1.575-8.373 6.28a1.5 1.5 0 0 1-1.754 0L3.25 7.575V17.25c0 .414.336.75.75.75h16.5a.75.75 0 0 0 .75-.75V7.575Z" />
    </svg>
  );
}

function LinkedInIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className="h-4 w-4 shrink-0"
      aria-hidden="true"
    >
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.446-2.136 2.94v5.666H9.351V9h3.414v1.561h.049c.476-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 1 1 0-4.124 2.062 2.062 0 0 1 0 4.124zM7.114 20.452H3.56V9h3.554v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
    </svg>
  );
}

function GitHubIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className="h-4 w-4 shrink-0"
      aria-hidden="true"
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.57.11.78-.25.78-.55 0-.27-.01-1.17-.02-2.12-3.2.7-3.88-1.36-3.88-1.36-.52-1.34-1.28-1.69-1.28-1.69-1.04-.72.08-.7.08-.7 1.15.08 1.76 1.19 1.76 1.19 1.03 1.75 2.7 1.25 3.36.96.1-.75.4-1.25.73-1.54-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.29 1.19-3.09-.12-.29-.52-1.47.11-3.06 0 0 .97-.31 3.18 1.18a11.05 11.05 0 0 1 5.8 0c2.21-1.49 3.18-1.18 3.18-1.18.63 1.59.23 2.77.11 3.06.74.8 1.19 1.83 1.19 3.09 0 4.42-2.7 5.4-5.26 5.68.42.36.78 1.08.78 2.17 0 1.57-.01 2.83-.01 3.22 0 .3.2.67.79.55A10.51 10.51 0 0 0 23.5 12c0-6.35-5.15-11.5-11.5-11.5Z"
      />
    </svg>
  );
}

function DeveloperPhoto({ developer }) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div
        className="flex h-32 w-32 items-center justify-center rounded-full bg-blue-100 text-3xl font-semibold text-blue-700 ring-4 ring-white dark:bg-blue-900 dark:text-blue-100 dark:ring-gray-800"
        aria-label={`${developer.name} photo unavailable`}
      >
        {developer.name
          .split(" ")
          .map((part) => part[0])
          .join("")}
      </div>
    );
  }

  return (
    <img
      src={developer.photo}
      alt={`${developer.name}, Dorm Mart developer`}
      className="h-32 w-32 rounded-full object-cover ring-4 ring-white dark:ring-gray-800"
      loading="lazy"
      onError={() => setFailed(true)}
    />
  );
}

function AboutUs() {
  return (
    <SettingsLayout>
      <div className="mx-auto max-w-6xl">
        <section className="overflow-hidden rounded-2xl bg-gradient-to-br from-blue-700 to-blue-500 px-6 py-10 text-center text-white sm:px-10">
          <p className="mb-2 text-sm font-semibold uppercase tracking-[0.2em] text-blue-100">
            Behind Dorm Mart
          </p>
          <h1 className="font-serif text-3xl font-bold sm:text-4xl">
            Teamwork Makes The Dream Work
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-blue-50 sm:text-lg">
            We built Dorm Mart to make it easier for students to buy and sell campus
            essentials. Questions, ideas, or feedback? We would love to hear from you.
          </p>
        </section>

        <section
          className="mt-8 grid gap-6 md:grid-cols-2 xl:grid-cols-3"
          aria-label="Dorm Mart developers"
        >
          {developers.map((developer) => (
            <article
              key={developer.email}
              className="flex flex-col items-center rounded-2xl border border-gray-200 bg-gray-50 px-6 py-8 text-center shadow-sm dark:border-gray-700 dark:bg-gray-900"
            >
              <DeveloperPhoto developer={developer} />
              <h2 className="mt-5 text-2xl font-bold text-gray-900 dark:text-white">
                {developer.name}
              </h2>
              <p className="mt-1 text-sm font-semibold uppercase tracking-wide text-blue-600 dark:text-blue-300">
                {developer.title}
              </p>
              <p className="mt-4 flex-1 leading-6 text-gray-600 dark:text-gray-300">
                {developer.contribution}
              </p>
              <a
                href={`mailto:${developer.email}`}
                className="mt-5 break-all text-sm font-medium text-gray-700 underline decoration-gray-300 underline-offset-4 hover:text-blue-700 dark:text-gray-200 dark:hover:text-blue-300"
              >
                {developer.email}
              </a>

              <div className="mt-5 grid w-full grid-cols-1 gap-2 sm:grid-cols-3">
                <a
                  href={`mailto:${developer.email}`}
                  className="flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-2 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:bg-blue-800 dark:hover:bg-blue-900"
                >
                  <EmailIcon />
                  Email
                </a>
                <a
                  href={developer.linkedin}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-center gap-2 rounded-lg bg-[#0A66C2] px-2 py-2.5 text-sm font-semibold text-white transition hover:bg-[#084d92] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                >
                  <LinkedInIcon />
                  LinkedIn
                </a>
                <a
                  href={developer.github}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-center gap-2 rounded-lg bg-gray-800 px-2 py-2.5 text-sm font-semibold text-white transition hover:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:bg-gray-700 dark:hover:bg-gray-600"
                >
                  <GitHubIcon />
                  GitHub
                </a>
              </div>
            </article>
          ))}
        </section>
      </div>
    </SettingsLayout>
  );
}

export default AboutUs;
