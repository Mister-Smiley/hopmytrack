import Result from "../structures/Result";
import Website from "../structures/Website";
import makeUsernames from "../util/makeUsernames";
import fetch from "../util/fetch";
import findEmails from "../util/findEmails";
import findPhones from "../util/findPhones";
import findNames from "../util/findNames";
import findUrls from "../util/findUrls";
import options from "../options";

const blacklistedLinks = [
	"facebook.com/plesk",
	"youtube.com/channel/uceu-_6yhgqfcvshlbexlnla",
	"youtube.com/embed",
];

const domains = [
	"com",
	"org",
	"ru",
	"de",
	"net",
	"br",
	"uk",
	"jp",
	"fr",
	"it",
	"io",
	"github.io",
	// "vercel.app",
	// "is-a.dev",
];

function getURLFromHref(rootUrl: string, html: string) {
	const url = new URL(rootUrl);

	const hrefs = [
		...html.matchAll(
			new RegExp(
				`href\\s*=\\s*"(?<content>(?:https?:\\/\\/(?:[a-zA-Z0-9-]*\\.)*${url.hostname.replace(
					/[\\\.]/g,
					"\\$&"
				)})?\\/?[a-zA-Z0-9_~#?%&/-]*(?:|\\.(?:html?|php)))"`,
				"g"
			)
		),
	];

	return hrefs
		.map((href) => href.groups?.content!)
		.filter((href) => !!href)
		.map((href) => {
			if (href!.startsWith("/")) {
				return `https://${url.hostname}${href}`;
			}

			if (!href!.startsWith(`https://${url.hostname}`)) {
				return `https://${url.hostname}/${href}`;
			}

			return href;
		});
}

async function websiteData(
	result: Result,
	url: string,
	html: string,
	ttl: number = 3
) {
	if (ttl <= 0) return result;

	const { firstNames, lastNames } = findNames(html);
	const emails = await findEmails(html);
	const phones = findPhones(html);

	findUrls(result, html, [new URL(url).hostname, ...blacklistedLinks]);

	firstNames.forEach((firstName) =>
		result.addFirstName(firstName.value, firstName.prob)
	);

	lastNames.forEach((lastName) =>
		result.addLastName(lastName.value, lastName.prob)
	);

	emails.forEach((email) => result.addEmail(email, email.prob));
	phones.forEach((phone) => result.addPhone(phone, phone.prob));

	const childrenUrls = getURLFromHref(url, html);

	for (const url of childrenUrls) {
		const response = await fetch(url, {
			abortIfCached: true,
			headers: Website.DEFAULT_HEADERS,
			proxy: options.proxy,
		});

		if (!response?.ok) return;
		const html = await response.text();
		await websiteData(result, url, html, ttl - 1);
	}
}

export default new Website({
	id: "personal",
	title: "Personal Website",
	type: Website.Type.PERSONAL,
	nsfw: false,
	actions: [
		Website.Actions.PAGE_NAMES,
		Website.Actions.PAGE_LOCATIONS,
		Website.Actions.PAGE_EMAILS,
		Website.Actions.PAGE_PHONES,
		Website.Actions.PAGE_URLS,
	],
	execute: async (previousResult) => {
		const usernames = makeUsernames(previousResult, {
			regex: /^(?![0-9]+$)(?!-)[a-zA-Z0-9-]{1,63}(?<!-)(?:\.[a-zA-Z]{2,})*$/g,
		});

		const results: Result[][] = await Promise.all(
			domains.map(async (domain) => {
				const results = await Promise.all(
					usernames.map(async (username) => {
						const requestUrl = `https://${username.value}.${domain}`;

						const response = await fetch(requestUrl, {
							abortIfCached: true,
							headers: Website.DEFAULT_HEADERS,
							proxy: options.proxy,
						});

						if (!response?.ok) return null;
						const html = await response.text();

						const result = new Result({
							id: "personal",
							type: Website.Type.PERSONAL,
							title: "Personal Website",
							url: requestUrl,
							username: username.value,
							fetched: true,
							parent: previousResult,
							prob: username.prob,
						});

						await websiteData(result, requestUrl, html);

						return result;
					})
				);

				return results.filter((result) => !!result) as Result[];
			})
		);

		return results.flat();
	},
});
