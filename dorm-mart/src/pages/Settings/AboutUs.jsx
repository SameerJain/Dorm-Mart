import { useState } from "react";
import SettingsLayout from "./SettingsLayout";
import sameerPhoto from "../../assets/team/sameer-jain.png";
import anishPhoto from "../../assets/team/anish-banerjee.png";
import chrisPhoto from "../../assets/team/chris-kim.png";

const developers = [
  {
    name: "Sameer Jain",
    email: "sameerjain501@gmail.com",
    github: "https://github.com/SameerJain",
    linkedin: "https://www.linkedin.com/in/sameer-jain1/",
    photo: sameerPhoto,
    contribution:
      "Worked across Dorm Mart's authentication, security, deployment, and marketplace experience.",
  },
  {
    name: "Anish Banerjee",
    email: "anishbancse312@gmail.com",
    github: "https://github.com/anishcse312",
    linkedin: "https://www.linkedin.com/in/anish-banerjee-71aba9290/",
    photo: anishPhoto,
    contribution:
      "Built profile, receipt, purchase history, and landing-page experiences across the app.",
  },
  {
    name: "Chris Kim",
    email: "sooseokkim99@gmail.com",
    github: "https://github.com/chris-sooseok",
    linkedin: "https://www.linkedin.com/in/kim-chris-sooseok/",
    photo: chrisPhoto,
    contribution:
      "Built chat, wishlist notifications, FAQs, and responsive navigation experiences.",
  },
];

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
          <h1 className="font-serif text-3xl font-bold sm:text-4xl">Meet our team</h1>
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
              className="flex flex-col items-center rounded-2xl border border-gray-200 bg-gray-50 px-6 py-8 text-center shadow-sm transition hover:-translate-y-1 hover:shadow-md dark:border-gray-700 dark:bg-gray-900"
            >
              <DeveloperPhoto developer={developer} />
              <h2 className="mt-5 text-2xl font-bold text-gray-900 dark:text-white">
                {developer.name}
              </h2>
              <p className="mt-1 text-sm font-semibold uppercase tracking-wide text-blue-600 dark:text-blue-300">
                Full-stack developer
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
                  className="rounded-lg bg-blue-600 px-2 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:bg-blue-800 dark:hover:bg-blue-900"
                >
                  Email
                </a>
                <a
                  href={developer.linkedin}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-lg border border-gray-300 px-2 py-2.5 text-sm font-semibold text-gray-700 transition hover:border-blue-500 hover:text-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:border-gray-600 dark:text-gray-200 dark:hover:border-blue-400 dark:hover:text-blue-300"
                >
                  LinkedIn
                </a>
                <a
                  href={developer.github}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-lg border border-gray-300 px-2 py-2.5 text-sm font-semibold text-gray-700 transition hover:border-blue-500 hover:text-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:border-gray-600 dark:text-gray-200 dark:hover:border-blue-400 dark:hover:text-blue-300"
                >
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
