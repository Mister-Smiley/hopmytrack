import Website from "../structures/Website";

export default Website.fromJSON("npm", {
  title: "NPM",
  type: Website.Type.DEVELOPMENT,
  requestUrl: "https://npmjs.com/~{username}",
  errorType: Website.ErrorType.STATUS_CODE,
  headers: Website.DEFAULT_HEADERS,
  requestInterval: 1000,
  findNames: true,
  nameSelector: ".eaac77a6.mv2",
  usernameOptions: {
    regex: /^(?!-)(?!.*--)[a-z0-9_-]{1,214}(?<!-)$/,
  },
});
