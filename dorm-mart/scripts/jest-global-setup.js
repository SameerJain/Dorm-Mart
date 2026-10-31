// Jest globalSetup (wired in package.json "jest"): runs once in the parent
// process before any test, so the setting reaches every worker and Stryker run.
//
// Run every test in UTC. The team works in Eastern time, which is also the
// time zone the scheduling code converts to, so a test could pass on a
// developer's machine only because a missing offset happened to be read as
// local Eastern time. Pinning a different zone makes that mistake fail.
module.exports = () => {
  process.env.TZ = "UTC";
};
