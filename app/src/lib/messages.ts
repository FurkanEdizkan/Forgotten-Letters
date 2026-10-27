/**
 * Every interface string, grouped by page (N14). A translation later means translating this file.
 * Server messages from services (errors, field messages) come from the services and schemas.
 */
import type { Role } from './roles';

export const m = {
	app: {
		name: 'Forgotten Letters',
		tagline: 'A campaign companion for Trench Crusade',
		notice: 'Unofficial fan-made app. Not affiliated with Factory Fortress Inc.'
	},

	common: {
		save: 'Save',
		copy: 'Copy',
		copied: 'Copied',
		confirmHint: 'Press again within 4 seconds to confirm.',
		never: 'Never',
		you: 'you',
		next: 'Older entries',
		first: 'Newest entries',
		nextPeople: 'More people',
		selectHint: 'Select the text and copy it.'
	},

	roles: {
		owner: 'Owner',
		admin: 'Campaign Master',
		user: 'Player'
	} satisfies Record<Role, string>,

	header: {
		areas: 'Areas',
		account: 'Account',
		signOut: 'Sign out',
		signedInAs: 'Signed in as'
	},

	login: {
		title: 'Sign in',
		username: 'Username',
		password: 'Password',
		remember: 'Remember me',
		rememberHint: 'Stay signed in on this device for 30 days.',
		submit: 'Sign in',
		signingIn: 'Signing in…',
		noAccount: 'Setup is done. Ask the Owner for an invite link.'
	},

	welcome: {
		title: 'Welcome',
		setup: 'Setup',
		setupHint: 'Create the Owner, about 2 min',
		docs: 'User docs',
		support: 'Support us',
		patreon: 'Support us on Patreon',
		coffee: 'Buy us a coffee',
		bitcoin: 'Donate in Bitcoin',
		legal: 'Legal and help',
		terms: 'Terms of service',
		privacy: 'Privacy',
		licence: 'Licence (AGPL-3.0)',
		contact: 'Contact',
		faq: 'FAQ',
		unofficial: 'Unofficial fan project · not affiliated with Factory Fortress'
	},

	wizard: {
		title: 'Setup',
		progress: 'Setup progress',
		stepDone: 'done',
		steps: ['Owner', 'Look', 'Server', 'Done'],
		back: 'Back',
		next: 'Next',
		finish: 'Finish',
		finishing: 'Finishing…',
		fixFields: 'Check the highlighted fields.',
		needsScript: 'Setup needs JavaScript. Turn it on for this page, then reload.',
		owner: {
			title: 'The Owner account',
			description: 'The first account. It runs this copy of Forgotten Letters.',
			username: 'Username',
			usernameHint: '3 to 32 characters: letters, digits, dot, dash, underscore. Used to sign in.',
			displayName: 'Display name',
			displayNameHint: 'What others see. You can change it later.',
			password: 'Password',
			passwordHint: '10 to 128 characters.',
			passwordCount: (n: number) => `This one has ${n}.`,
			repeat: 'Repeat password',
			repeatPlaceholder: 'Type it again',
			repeatMismatch: 'The two passwords differ. Type the same one twice.',
			note: "The Owner can do everything, including resetting other people's passwords. Keep this password safe."
		},
		look: {
			title: 'How it looks',
			description: 'For everyone in this group. The Owner can change it later.',
			textSize: 'Text size',
			accent: 'Accent',
			preview: 'Preview',
			// Invented example data for the preview card; never book text.
			sampleTitle: 'The Siege of Hollow Ridge',
			sampleMeta: 'Turn 4 · Carcass Front · 6 warbands',
			sampleBody:
				'The Iron Choir held the ridge through the night. At dawn the Campaign Master records the result, and each warband sees its new standing on the map.',
			sampleChip: 'Victory',
			sampleButton: 'Record result'
		},
		server: {
			title: 'Where it listens',
			description: 'The port is the number at the end of the address people open.',
			direct: 'Runs directly',
			docker: 'Runs in Docker',
			port: 'Port',
			portHint: '1024 to 65535.',
			address: 'Address after Finish',
			addressHint: 'Share this with your players.',
			moveNote:
				'When you press Finish the app opens the new port, takes you there, then closes the old one.',
			lockedTag: 'Set by Docker',
			lockedHow: 'To change it, edit .env and restart',
			lockedNote: 'This copy runs in Docker or in development, so the port is set outside the app.'
		},
		done: {
			title: 'Ready',
			description: 'Check the choices, then press Finish to create the Owner and sign in.',
			account: 'Owner',
			look: 'Look',
			address: 'Address',
			textSize: (v: number) => `Text ${v} %`
		}
	},

	accents: {
		blood: 'Blood',
		brass: 'Brass',
		verdigris: 'Verdigris',
		bruise: 'Bruise',
		ash: 'Ash'
	},

	invite: {
		title: 'Join the group',
		open: (inviter: string, role: string) => `${inviter} invited you to join as ${role}.`,
		expires: 'The link works until',
		used: 'This invite was already used.',
		expired: 'This invite has expired.',
		revoked: 'This invite was withdrawn.',
		unknown: 'This invite link does not exist.',
		askAgain: 'Ask the person who invited you for a new link.',
		username: 'Username',
		usernameHint:
			'3 to 32 characters: letters, digits, dot, dash, underscore. Used only to sign in.',
		displayName: 'Display name',
		displayNameHint: 'Shown wherever you appear. You can change it later.',
		password: 'Password',
		passwordHint: '10 to 128 characters.',
		submit: 'Create account',
		toLogin: 'Go to sign in'
	},

	home: {
		title: 'Home',
		heading: 'The front is quiet',
		signedInAs: (name: string) => `You are signed in as ${name}.`,
		later:
			'Campaigns, warbands, the map and battle results arrive in the next steps. Until then there is nothing to do here.',
		account: 'Change your display name or password in your account.'
	},

	account: {
		title: 'Account',
		nameHeading: 'Display name',
		displayName: 'Display name',
		displayNameHint: 'Shown wherever you appear.',
		nameSaved: 'Display name saved.',
		passwordHeading: 'Password',
		current: 'Current password',
		newPassword: 'New password',
		newPasswordHint: '10 to 128 characters.',
		changePassword: 'Change password',
		passwordChanged: 'Password changed. Your other devices were signed out.',
		devicesHeading: 'Devices',
		devicesIntro: 'Where you are signed in now.',
		device: 'Device',
		address: 'Address',
		lastSeen: 'Last seen',
		kind: 'Session',
		thisDevice: 'This device',
		remembered: 'Remembered 30 days',
		browserSession: 'Until the browser closes',
		unknownDevice: 'Unknown browser',
		signOutEverywhere: 'Sign out other devices',
		signOutEverywhereConfirm: 'Sign out all others?',
		signedOutEverywhere: 'Your other devices were signed out.',
		username: 'Username'
	},

	forcedPassword: {
		title: 'Choose a new password',
		intro:
			'Your password was reset. Enter the temporary password you were given, then choose your own.',
		current: 'Temporary password',
		newPassword: 'New password',
		newPasswordHint: '10 to 128 characters.',
		submit: 'Set password'
	},

	owner: {
		title: 'Owner',
		tabs: { people: 'People', invites: 'Invites', audit: 'Audit log', backups: 'Backups' },
		httpWarning:
			'This copy is served over plain HTTP. Passwords and sessions cross the network unencrypted. Use the https profile on an internet server.'
	},

	people: {
		heading: 'People',
		intro:
			'Every account on this copy. Nobody is ever deleted; disable an account to stop it signing in.',
		name: 'Name',
		role: 'Role',
		status: 'Status',
		lastSignIn: 'Last sign-in',
		actions: 'Actions',
		active: 'Active',
		disabled: 'Disabled',
		anonymised: 'Anonymised',
		mustChange: 'Must change password',
		changeRole: 'Change role',
		roleFor: (name: string) => `Role for ${name}`,
		disable: 'Disable',
		disableConfirm: 'Really disable?',
		enable: 'Enable',
		reset: 'Reset password',
		resetConfirm: 'Really reset?',
		anonymise: 'Anonymise',
		anonymiseConfirm: 'Anonymise for good?',
		temporary: (name: string) => `Temporary password for ${name}`,
		temporaryHelp: 'Shown only now. Hand it over; they must change it at the next sign-in.',
		roleChanged: 'Role changed.',
		disabledDone: 'Account disabled and signed out everywhere.',
		enabledDone: 'Account enabled.',
		anonymisedDone: 'Account anonymised.',
		empty: 'No accounts yet.',
		yourself: 'This is you'
	},

	invites: {
		heading: 'Invites',
		createHeading: 'New invite',
		intro: 'An invite is a link that works once, for 7 days, and fixes the role.',
		role: 'Role',
		note: 'Note',
		noteHint: 'Only you see it, e.g. who the link is for.',
		create: 'Create invite',
		linkReady: 'Invite link',
		linkHelp: 'Shown only now. Send it to the person; it works once.',
		pendingHeading: 'Pending invites',
		created: 'Created',
		expires: 'Expires',
		by: 'By',
		revoke: 'Revoke',
		revokeConfirm: 'Really revoke?',
		resend: 'New link',
		revoked: 'Invite revoked.',
		empty: 'No pending invites. Create one to bring someone in.',
		noNote: 'No note'
	},

	admin: {
		title: 'Campaign Master',
		intro: 'Invite players to the group. Campaigns arrive in the next step.',
		invitedHeading: 'People you invited',
		invitedEmpty: 'Nobody has joined from your invites yet.',
		ownerSees: 'As an owner you see every person in the owner area.',
		toPeople: 'Open People'
	},

	audit: {
		heading: 'Audit log',
		intro: 'Sign-ins, invites, role changes, disables and password resets, newest first.',
		when: 'When',
		who: 'Who',
		what: 'What',
		target: 'About',
		address: 'Address',
		nobody: 'Nobody',
		empty: 'Nothing recorded yet.',
		actions: {
			'setup.owner_created': 'Created the first owner',
			sign_in: 'Signed in',
			'sign_in.failed': 'Failed sign-in',
			sign_out: 'Signed out',
			'sign_out.everywhere': 'Signed out other devices',
			'password.changed': 'Changed password',
			'password.reset': 'Reset a password',
			'display_name.changed': 'Changed display name',
			'invite.created': 'Created an invite',
			'invite.revoked': 'Revoked an invite',
			'invite.accepted': 'Joined by invite',
			'role.changed': 'Changed a role',
			'account.disabled': 'Disabled an account',
			'account.enabled': 'Enabled an account',
			'account.anonymised': 'Anonymised an account',
			'backup.downloaded': 'Downloaded a backup',
			'backup.restored': 'Restored a backup'
		} as Record<string, string>,
		roleChange: (from: string, to: string) => `${from} to ${to}`,
		invite: 'an invite'
	},

	backups: {
		heading: 'Backups',
		intro: 'A dump is written every day and before every update; the last 14 days are kept.',
		file: 'File',
		size: 'Size',
		created: 'Written',
		download: 'Download',
		restore: 'Restore',
		restoreConfirm: 'Overwrite data?',
		restored: (safety: string) => `Backup restored. The data from before is saved as ${safety}.`,
		empty: 'No backups yet. The first one is written tonight or at the next update.'
	},

	errors: {
		title: 'Something is wrong',
		requestId: 'Request id',
		quote: 'Quote it when asking for help.',
		back: 'Go to the start',
		byStatus: {
			400: 'That request was not valid.',
			401: 'Sign in first.',
			403: 'This area is not open to your role.',
			404: 'There is nothing at this address.',
			409: 'Someone changed this meanwhile. Reload and try again.',
			429: 'Too many tries. Wait a moment and try again.',
			500: 'Something went wrong. Quote the request id when asking for help.',
			503: 'The app is starting. Try again in a moment.'
		} as Record<number, string>,
		forbidden: 'This area is not open to your role.'
	}
};

/** The size of a file in plain units. */
export const fileSize = (bytes: number) =>
	bytes < 1024
		? `${bytes} B`
		: bytes < 1024 ** 2
			? `${(bytes / 1024).toFixed(0)} KB`
			: `${(bytes / 1024 ** 2).toFixed(1)} MB`;
