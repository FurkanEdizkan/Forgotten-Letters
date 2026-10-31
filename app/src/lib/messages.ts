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

	shell: {
		skip: 'Skip to the page',
		menu: 'Menu',
		docs: 'Docs',
		areas: 'Areas',
		helpLinks: 'Help and legal',
		userMenu: (name: string) => `Account menu for ${name}`,
		signedInAs: (username: string, role: string) => `Signed in as ${username} · ${role}`,
		userSettings: 'User settings',
		logOut: 'Log out',
		signIn: 'Sign in',
		loading: 'Loading the page…'
	},

	help: {
		titles: {
			docs: 'Docs',
			faq: 'FAQ',
			licence: 'Licence',
			contact: 'Contact',
			support: 'Support us',
			privacy: 'Privacy',
			terms: 'Terms',
			unofficial: 'Unofficial notice'
		},
		coming: 'This page is coming in a later step.',
		licence: 'Forgotten Letters is free software under the AGPL-3.0.',
		unofficial:
			'Forgotten Letters is an unofficial fan project, not affiliated with Factory Fortress Inc.'
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
		heading: 'Your campaigns',
		signedInAs: (name: string) => `You are signed in as ${name}.`,
		later: 'Warbands, the map and battle results arrive in the next steps.',
		account: 'Change your display name or password in your account.'
	},

	campaigns: {
		title: 'Campaigns',
		newCampaign: 'New campaign',
		deleted: (n: number) => `Deleted (${n})`,
		deletedTitle: 'Deleted campaigns',
		deletedIntro:
			'Deleted campaigns are kept for 30 days, then removed for good. The CM or an Owner can restore them.',
		deletedEmpty: 'No deleted campaigns.',
		deletedOn: (d: string) => `deleted ${d}`,
		restore: 'Restore',
		restored: 'Campaign restored.',
		backToList: 'All campaigns',
		yours: 'Your campaigns',
		listed: 'Listed campaigns',
		listedHint: 'open to ask',
		emptyRunner: 'No campaigns yet. Create the first one; players join through seat links.',
		emptyPlayer: 'No campaigns yet. Ask your Campaign Master for a seat link.',
		howTo: 'How campaigns work',
		allCampaigns: 'All campaigns…',
		sidePanel: 'Campaigns',
		// Card facts (campaign-facts.ts).
		seatsTaken: (n: number, of: number) => `${n} of ${of} seats taken`,
		startsOn: (d: string) => `starts ${d}`,
		endsOn: (d: string) => `ends ${d}`,
		endedOn: (d: string) => `ended ${d}`,
		gamesEach: (n: number) => `${n} ${n === 1 ? 'game' : 'games'} each`,
		cmIs: (name: string) => `CM ${name}`,
		coCmIs: (name: string) => `co-CM ${name}`,
		range: (from: string, to: string) => `${from} to ${to}`,
		from: (d: string) => `from ${d}`,
		until: (d: string) => `until ${d}`,
		kinds: { carcass_front: 'Carcass Front', generic: 'Generic' },
		stages: { mustering: 'Mustering', active: 'Active', ended: 'Ended' },
		roles: { cm: 'CM', co_cm: 'co-CM', player: 'Player' },
		visibility: { listed: 'Listed', private: 'Private' },
		ask: 'Ask to join',
		askNote: 'Note for the CM',
		askNoteHint: 'Optional. Up to 300 characters.',
		askSend: 'Send request',
		askCancel: 'Cancel',
		requestSent: 'Request sent',
		requestWaiting: 'Waiting for the CM',
		withdraw: 'Withdraw request',
		withdrawn: 'Request withdrawn.',

		wizard: {
			title: 'New campaign',
			progress: 'Campaign progress',
			stepDone: 'done',
			steps: ['Basics', 'Schedule', 'Seats', 'House rules', 'Map', 'Review'],
			cancel: 'Cancel',
			back: 'Back',
			next: 'Next',
			skip: 'Skip',
			create: 'Create campaign',
			creating: 'Creating…',
			edit: 'Edit',
			editStep: (step: string) => `Edit ${step}`,
			needsScript: 'The wizard needs JavaScript. Turn it on for this page, then reload.',
			preview: 'Card preview',
			previewName: 'Your campaign',
			basics: {
				title: 'Basics',
				description:
					'You become its Campaign Master. Everything except the type can be changed later.',
				name: 'Name',
				nameHint: 'Shown to players on cards and in the side panel.',
				kind: 'Type',
				kindHint: "Keeps the Carcass Front's campaign shape. The type cannot change later.",
				genericHint: 'A blank campaign. The type cannot change later.',
				description_: 'Short description',
				count: (n: number, of: number) => `${n} / ${of}`
			},
			schedule: {
				title: 'Schedule and visibility',
				description:
					'The dates and the game count are optional. Leave them empty if you have not decided.',
				games: 'Games per player (1 to 50)',
				start: 'Start date',
				end: 'End date',
				who: 'Who can find it',
				listedHelp:
					'Everyone signed in sees it on the campaigns page and can ask to join while it is mustering.',
				privateHelp:
					'Only its members see it. People join through seat links or when the CM adds them by name.'
			},
			seats: {
				title: 'Seats',
				description: 'One seat per player. You can add seats later; empty seats can be removed.',
				count: 'Number of seats',
				made: 'These seats are made',
				note: 'Each seat gets its own one-time link on the manage page. When a player takes a seat, it is renamed to their display name.'
			},
			rules: {
				title: 'House rules',
				description:
					"Your group's own rules, in your own words. Each one is a switch you can turn on or off later. Up to 30.",
				name: (n: number) => `Name of rule ${n}`,
				text: (n: number) => `Explanation of rule ${n}`,
				colName: 'Name',
				colText: 'Explanation',
				colOn: 'On',
				namePlaceholder: 'Name the rule',
				textPlaceholder: 'Explain it in a sentence or two (up to 500 characters)',
				// The switch announces on or off itself; its name is the rule's.
				on: (name: string) => name || 'New rule',
				remove: 'Remove',
				add: 'Add a rule',
				count: (n: number, of: number) => `${n} of ${of} · names up to 60 characters`,
				empty: 'No house rules yet. Add one, or move on.'
			},
			map: {
				title: 'Map',
				description: 'Not available yet.',
				note: 'Maps arrive in step 2.5: upload your map, draw locations, save templates.'
			},
			review: {
				title: 'Review',
				description:
					'Check the campaign, then create it. You land on its manage page to share the seat links.',
				name: 'Name',
				kind: 'Type',
				description_: 'Description',
				schedule: 'Schedule',
				visibility: 'Visibility',
				seats: 'Seats',
				rules: 'House rules',
				map: 'Map',
				none: 'None',
				notSet: 'Not set',
				seatsRange: (n: number) => `${n} (Seat 1 to Seat ${n})`,
				seatName: (n: number) => `Seat ${n}`,
				rulesOn: (n: number, on: number) => `${n} ${n === 1 ? 'rule' : 'rules'}, ${on} on`,
				mapSkipped: 'Skipped (step 2.5)'
			}
		},

		page: {
			houseRules: 'House rules',
			noRules: 'No house rules.',
			on: 'On',
			off: 'Off',
			seats: 'Seats',
			seatsTaken: (n: number, of: number) => `${n} of ${of} taken`,
			you: '(you)',
			open: 'open',
			leave: 'Leave seat',
			leaveConfirm: 'Leave for good?',
			leaveHint: 'You can leave while the campaign is mustering.',
			manage: 'Manage',
			requestSentNote: 'Your request is with the CM.',
			handOver: 'Hand over the CM role',
			handOverHint:
				"As an Owner you can give this campaign's CM role to a co-CM, or take it yourself. The CM now becomes a co-CM.",
			newCm: 'New CM',
			takeIt: (name: string) => `${name} (take the CM role yourself)`,
			handOverButton: 'Hand over',
			handOverConfirm: 'Hand over for good?',
			handedOver: 'The CM role was handed over.'
		},

		manage: {
			tabs: 'Manage the campaign',
			created: 'Campaign created. Make the seat links and send each player theirs.',
			stage: 'Stage',
			start: 'Start the campaign',
			end: 'End campaign',
			endConfirm: 'End for good?',
			backToMustering: 'Back to mustering',
			endLater: 'End campaign is available once it is active.',
			endedNote: 'This campaign has ended. It is kept read-only for its history.',
			view: 'View campaign',
			seats: {
				tab: 'Seats',
				findLabel: 'Fill a seat by name',
				findPlaceholder: 'Type a display name or username',
				find: 'Find',
				people: 'People who match',
				noMatch: 'Nobody matches. Only accounts without a seat here are shown.',
				seat: 'Seat',
				assign: 'Add to seat',
				assigned: 'Added to the seat.',
				allLinks: 'Make links for all empty seats',
				linksHelp: 'Shown only now. Send each player their own link; each works once, for 7 days.',
				number: '#',
				name: 'Seat',
				player: 'Player',
				joined: 'Joined',
				actions: 'Actions',
				notYet: 'not yet',
				openSeat: 'open',
				linkOut: 'link out',
				rename: (name: string) => `Rename ${name}`,
				newName: (name: string) => `New name for ${name}`,
				renameSave: 'Save',
				renameCancel: 'Cancel',
				free: 'Free seat',
				freeConfirm: 'Free seat for good?',
				makeLink: 'Make link',
				newLink: 'New link',
				linkFor: (seat: string) => `Link for ${seat}`,
				linkHelp: (until: string) => `Shown once · valid to ${until}`,
				revoke: 'Revoke',
				remove: 'Remove',
				removeConfirm: 'Remove for good?',
				add: 'Add seats',
				addCount: 'Seats to add',
				footer: (n: number, of: number) =>
					`${n} of ${of} seats. Links are shown once; making a new one revokes the old.`,
				linksClosed: 'Seat links work only while the campaign is mustering.',
				noEmpty: 'Every seat is taken. Add a seat first.'
			},
			requests: {
				tab: 'Requests',
				asked: (d: string) => `asked ${d}`,
				seat: 'Seat',
				approve: 'Approve',
				decline: 'Decline',
				empty: 'No open requests. People ask to join listed campaigns while they are mustering.',
				noSeat: 'Every seat is taken. Add a seat on the Seats tab to approve.'
			},
			cocms: {
				tab: 'Co-CMs',
				person: 'Person',
				siteRole: 'Site role',
				role: 'Campaign role',
				actions: 'Actions',
				remove: 'Remove co-CM',
				removeConfirm: 'Remove for good?',
				transfer: 'Hand over the CM role',
				transferConfirm: 'Hand over for good?',
				add: 'Add a co-CM (Admins and Owners)',
				addPlaceholder: 'Type a display name or username',
				find: 'Find',
				people: 'People who match',
				addButton: 'Add co-CM',
				noMatch: 'Nobody matches. Only active Admins and Owners who are not in it yet are shown.',
				onlyCm: 'Only the CM adds and removes co-CMs.'
			},
			settings: {
				tab: 'Settings',
				save: 'Save settings',
				saved: 'Settings saved.',
				kindFixed: 'The type cannot change after creation.',
				ended: 'The campaign has ended; its settings are read-only.'
			},
			danger: {
				tab: 'Danger',
				heading: 'Delete this campaign',
				text: 'It disappears for everyone. You or an Owner can restore it from Campaigns → Deleted for 30 days; then it is removed for good.',
				delete: 'Delete campaign',
				confirm: 'Delete for good?'
			}
		}
	},

	join: {
		title: 'Take a seat',
		invited: (seat: string) => `You're invited to take ${seat}.`,
		meta: (kind: string, cm: string, until: string) =>
			`${kind} · CM ${cm} · link valid until ${until}`,
		how: 'How to join',
		signIn: 'Sign in',
		signUp: 'Create an account',
		username: 'Username',
		password: 'Password',
		usernameHint: '3 to 32 characters: letters, digits, dot, dash, underscore. Used to sign in.',
		displayName: 'Display name',
		displayNameHint: 'What others see. Your seat takes this name.',
		passwordHint: '10 to 128 characters.',
		signInSubmit: 'Sign in and take the seat',
		signUpSubmit: 'Create account and take the seat',
		take: 'Take the seat',
		signedInAs: (name: string) => `You are signed in as ${name}.`,
		busy: 'Joining…',
		later: 'The same account can join other campaigns later.',
		usedTitle: 'Link already used',
		used: (campaign: string) =>
			`This seat in ${campaign} is taken. If it is yours, sign in to see the campaign.`,
		revokedTitle: 'Link withdrawn',
		revoked: (campaign: string) =>
			`The Campaign Master replaced or withdrew this link to a seat in ${campaign}.`,
		expiredTitle: 'Link expired',
		expired: (d: string) => `Seat links last 7 days. This one ended on ${d}.`,
		unknownTitle: 'This link does not work',
		unknown: 'It may be mistyped, or a newer link replaced it.',
		askAgain: 'Ask the Campaign Master for a new link.',
		toLogin: 'Go to sign in',
		toCampaign: 'Open the campaign'
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
		tabs: {
			people: 'People',
			invites: 'Invites',
			settings: 'Settings',
			audit: 'Audit log',
			backups: 'Backups'
		},
		httpWarning:
			'This copy is served over plain HTTP. Passwords and sessions cross the network unencrypted. Use the https profile on an internet server.'
	},

	settings: {
		heading: 'Settings',
		intro:
			'The look and the address of this copy. The text size and accent apply to every page, for everyone.',
		lookHeading: 'Look',
		textScale: 'Text size',
		textScaleHint: 'Scales all text and spacing, from 90 to 130 %.',
		accent: 'Accent',
		accentHint: 'The colour of buttons, headings and the focus ring.',
		accents: {
			blood: 'Blood',
			brass: 'Brass',
			verdigris: 'Verdigris',
			bruise: 'Bruise',
			ash: 'Ash'
		},
		addressHeading: 'Address',
		address: 'People open this copy at',
		port: 'Port',
		portHint: '1024 to 65535. The app moves to the new port right away.',
		portLocked: 'The port is set outside the app. To change it, edit this line in .env:',
		portLockedThen: 'Then restart the app:',
		saved: 'Settings saved.',
		moving: (to: string) => `The app now listens at ${to}. Taking you there…`
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
		intro: 'Sign-ins, invites, role changes, campaigns and seats, newest first.',
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
			'backup.restored': 'Restored a backup',
			'campaign.created': 'Created a campaign',
			'campaign.updated': 'Changed campaign settings',
			'campaign.deleted': 'Deleted a campaign',
			'campaign.restored': 'Restored a campaign',
			'campaign.stage_changed': 'Moved a campaign to another stage',
			'campaign.co_cm_added': 'Added a co-CM',
			'campaign.co_cm_removed': 'Removed a co-CM',
			'campaign.cm_transferred': 'Handed over the CM role',
			'seat.added': 'Added seats',
			'seat.renamed': 'Renamed a seat',
			'seat.freed': 'Freed a seat',
			'seat.removed': 'Removed a seat',
			'seat.link_made': 'Made a seat link',
			'seat.link_revoked': 'Revoked a seat link',
			'seat.assigned': 'Added someone to a seat',
			'seat.joined': 'Took a seat by link',
			'seat.left': 'Left a seat',
			'request.made': 'Asked to join a campaign',
			'request.approved': 'Approved a join request',
			'request.declined': 'Declined a join request',
			'request.withdrawn': 'Withdrew a join request'
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
