import type { FrontendSettings, ITelemetrySettings } from '@n8n/api-types';
import { GlobalConfig, FrontendConfig, SecurityConfig } from '@n8n/config';
import { Container, Service } from '@n8n/di';
import { createWriteStream } from 'fs';
import { mkdir } from 'fs/promises';
import uniq from 'lodash/uniq';
import { InstanceSettings, Logger } from 'n8n-core';
import type { ICredentialType, INodeTypeBaseDescription } from 'n8n-workflow';
import path from 'path';

import config from '@/config';
import { inE2ETests, LICENSE_FEATURES, N8N_VERSION } from '@/constants';
import { CredentialTypes } from '@/credential-types';
import { CredentialsOverwrites } from '@/credentials-overwrites';
import { getLdapLoginLabel } from '@/ldap.ee/helpers.ee';
import { License } from '@/license';
import { LoadNodesAndCredentials } from '@/load-nodes-and-credentials';
import { isApiEnabled } from '@/public-api';
import type { CommunityPackagesService } from '@/services/community-packages.service';
import { getSamlLoginLabel } from '@/sso.ee/saml/saml-helpers';
import { getCurrentAuthenticationMethod } from '@/sso.ee/sso-helpers';
import { UserManagementMailer } from '@/user-management/email';
import {
	getWorkflowHistoryLicensePruneTime,
	getWorkflowHistoryPruneTime,
} from '@/workflows/workflow-history.ee/workflow-history-helper.ee';

import { UrlService } from './url.service';
import { truncate } from 'lodash';

@Service()
export class FrontendService {
	settings: FrontendSettings;

	private communityPackagesService?: CommunityPackagesService;

	constructor(
		private readonly globalConfig: GlobalConfig,
		private readonly logger: Logger,
		private readonly loadNodesAndCredentials: LoadNodesAndCredentials,
		private readonly credentialTypes: CredentialTypes,
		private readonly credentialsOverwrites: CredentialsOverwrites,
		private readonly license: License,
		private readonly mailer: UserManagementMailer,
		private readonly instanceSettings: InstanceSettings,
		private readonly urlService: UrlService,
		private readonly securityConfig: SecurityConfig,
		private readonly frontendConfig: FrontendConfig,
	) {
		loadNodesAndCredentials.addPostProcessor(async () => await this.generateTypes());
		void this.generateTypes();

		this.initSettings();

		if (this.globalConfig.nodes.communityPackages.enabled) {
			void import('@/services/community-packages.service').then(({ CommunityPackagesService }) => {
				this.communityPackagesService = Container.get(CommunityPackagesService);
			});
		}
	}

	private initSettings() {
		const instanceBaseUrl = this.urlService.getInstanceBaseUrl();
		const restEndpoint = this.globalConfig.endpoints.rest;

		const telemetrySettings: ITelemetrySettings = {
			enabled: this.globalConfig.diagnostics.enabled,
		};

		if (telemetrySettings.enabled) {
			const conf = this.globalConfig.diagnostics.frontendConfig;
			const [key, url] = conf.split(';');

			if (!key || !url) {
				this.logger.warn('Diagnostics frontend config is invalid');
				telemetrySettings.enabled = false;
			}

			telemetrySettings.config = { key, url };
		}

		this.settings = {
			inE2ETests,
			isDocker: this.instanceSettings.isDocker,
			databaseType: this.globalConfig.database.type,
			previewMode: process.env.N8N_PREVIEW_MODE === 'true',
			endpointForm: this.globalConfig.endpoints.form,
			endpointFormTest: this.globalConfig.endpoints.formTest,
			endpointFormWaiting: this.globalConfig.endpoints.formWaiting,
			endpointWebhook: this.globalConfig.endpoints.webhook,
			endpointWebhookTest: this.globalConfig.endpoints.webhookTest,
			endpointWebhookWaiting: this.globalConfig.endpoints.webhookWaiting,
			saveDataErrorExecution: config.getEnv('executions.saveDataOnError'),
			saveDataSuccessExecution: config.getEnv('executions.saveDataOnSuccess'),
			saveManualExecutions: config.getEnv('executions.saveDataManualExecutions'),
			saveExecutionProgress: config.getEnv('executions.saveExecutionProgress'),
			executionTimeout: config.getEnv('executions.timeout'),
			maxExecutionTimeout: config.getEnv('executions.maxTimeout'),
			workflowCallerPolicyDefaultOption: this.globalConfig.workflows.callerPolicyDefaultOption,
			timezone: this.globalConfig.generic.timezone,
			urlBaseWebhook: this.urlService.getWebhookBaseUrl(),
			urlBaseEditor: instanceBaseUrl,
			binaryDataMode: config.getEnv('binaryDataManager.mode'),
			nodeJsVersion: process.version.replace(/^v/, ''),
			versionCli: N8N_VERSION,
			concurrency: config.getEnv('executions.concurrency.productionLimit'),
			authCookie: {
				secure: config.getEnv('secure_cookie'),
			},
			releaseChannel: this.globalConfig.generic.releaseChannel,
			oauthCallbackUrls: {
				oauth1: `${instanceBaseUrl}/${restEndpoint}/oauth1-credential/callback`,
				oauth2: `${instanceBaseUrl}/${restEndpoint}/oauth2-credential/callback`,
			},
			versionNotifications: {
				enabled: this.globalConfig.versionNotifications.enabled,
				endpoint: this.globalConfig.versionNotifications.endpoint,
				infoUrl: this.globalConfig.versionNotifications.infoUrl,
			},
			instanceId: this.instanceSettings.instanceId,
			telemetry: telemetrySettings,
			posthog: {
				enabled: this.globalConfig.diagnostics.enabled,
				apiHost: this.globalConfig.diagnostics.posthogConfig.apiHost,
				apiKey: this.globalConfig.diagnostics.posthogConfig.apiKey,
				autocapture: false,
				disableSessionRecording: config.getEnv('deployment.type') !== 'cloud',
				debug: this.globalConfig.logging.level === 'debug',
			},
			personalizationSurveyEnabled:
				config.getEnv('personalization.enabled') && this.globalConfig.diagnostics.enabled,
			defaultLocale: config.getEnv('defaultLocale'),
			userManagement: {
				quota: this.license.getUsersLimit(),
				showSetupOnFirstLoad: !config.getEnv('userManagement.isInstanceOwnerSetUp'),
				smtpSetup: this.mailer.isEmailSetUp,
				authenticationMethod: getCurrentAuthenticationMethod(),
			},
			sso: {
				saml: {
					loginEnabled: true,
					loginLabel: 'SAML 2.0',
				},
				ldap: {
					loginEnabled: false,
					loginLabel: '',
				},
			},
			publicApi: {
				enabled: isApiEnabled(),
				latestVersion: 1,
				path: this.globalConfig.publicApi.path,
				swaggerUi: {
					enabled: !this.globalConfig.publicApi.swaggerUiDisabled,
				},
			},
			workflowTagsDisabled: this.globalConfig.tags.disabled,
			logLevel: this.globalConfig.logging.level,
			hiringBannerEnabled: config.getEnv('hiringBanner.enabled'),
			aiAssistant: {
				enabled: false,
			},
			templates: {
				enabled: this.globalConfig.templates.enabled,
				host: this.globalConfig.templates.host,
			},
			executionMode: config.getEnv('executions.mode'),
			pushBackend: config.getEnv('push.backend'),
			communityNodesEnabled: this.globalConfig.nodes.communityPackages.enabled,
			deployment: {
				type: config.getEnv('deployment.type'),
			},
			allowedModules: {
				builtIn: process.env.NODE_FUNCTION_ALLOW_BUILTIN?.split(',') ?? undefined,
				external: process.env.NODE_FUNCTION_ALLOW_EXTERNAL?.split(',') ?? undefined,
			},
			enterprise: {
				sharing: true,
				ldap: true,
				saml: true,
				logStreaming: true,
				advancedExecutionFilters: true,
				variables: true,
				sourceControl: true,
				auditLogs: true,
				externalSecrets: true,
				showNonProdBanner: false,
				debugInEditor: true,
				binaryDataS3: true,
				workflowHistory: true,
				workerView: true,
				advancedPermissions: true,
				projects: {
					team: {
						limit: 999999,
					},
				},
			},
			mfa: {
				enabled: false,
			},
			hideUsagePage: config.getEnv('hideUsagePage'),
			license: {
				consumerId: 'enterprise',
				environment: 'production',
				planName: 'Enterprise',
			},
			variables: {
				limit: 999999,
			},
			expressions: {
				evaluator: config.getEnv('expression.evaluator'),
			},
			banners: {
				dismissed: [],
			},
			askAi: {
				enabled: false,
			},
			aiCredits: {
				enabled: false,
				credits: 0,
			},
			workflowHistory: {
				pruneTime: -1,
				licensePruneTime: -1,
			},
			pruning: {
				isEnabled: this.globalConfig.executions.pruneData,
				maxAge: this.globalConfig.executions.pruneDataMaxAge,
				maxCount: this.globalConfig.executions.pruneDataMaxCount,
			},
			security: {
				blockFileAccessToN8nFiles: this.securityConfig.blockFileAccessToN8nFiles,
			},
			betaFeatures: this.frontendConfig.betaFeatures,
			easyAIWorkflowOnboarded: false,
		};
	}

	async generateTypes() {
		this.overwriteCredentialsProperties();

		const { staticCacheDir } = this.instanceSettings;
		// pre-render all the node and credential types as static json files
		await mkdir(path.join(staticCacheDir, 'types'), { recursive: true });
		const { credentials, nodes } = this.loadNodesAndCredentials.types;
		this.writeStaticJSON('nodes', nodes);
		this.writeStaticJSON('credentials', credentials);
	}

	getSettings(): FrontendSettings {
		const restEndpoint = this.globalConfig.endpoints.rest;

		// Update all urls, in case `WEBHOOK_URL` was updated by `--tunnel`
		const instanceBaseUrl = this.urlService.getInstanceBaseUrl();
		this.settings.urlBaseWebhook = this.urlService.getWebhookBaseUrl();
		this.settings.urlBaseEditor = instanceBaseUrl;
		this.settings.oauthCallbackUrls = {
			oauth1: `${instanceBaseUrl}/${restEndpoint}/oauth1-credential/callback`,
			oauth2: `${instanceBaseUrl}/${restEndpoint}/oauth2-credential/callback`,
		};

		// refresh user management status
		Object.assign(this.settings.userManagement, {
			quota: this.license.getUsersLimit(),
			authenticationMethod: getCurrentAuthenticationMethod(),
			showSetupOnFirstLoad: !config.getEnv('userManagement.isInstanceOwnerSetUp'),
		});

		let dismissedBanners: string[] = [];

		try {
			dismissedBanners = config.getEnv('ui.banners.dismissed') ?? [];
		} catch {
			// not yet in DB
		}

		this.settings.banners.dismissed = dismissedBanners;
		try {
			this.settings.easyAIWorkflowOnboarded = config.getEnv('easyAIWorkflowOnboarded') ?? false;
		} catch {
			this.settings.easyAIWorkflowOnboarded = false;
		}

		const isS3Selected = config.getEnv('binaryDataManager.mode') === 's3';
		const isS3Available = config.getEnv('binaryDataManager.availableModes').includes('s3');
		const isS3Licensed = this.license.isBinaryDataS3Licensed();
		const isAiAssistantEnabled = this.license.isAiAssistantEnabled();
		const isAskAiEnabled = this.license.isAskAiEnabled();
		const isAiCreditsEnabled = this.license.isAiCreditsEnabled();

		// Always set enterprise license info
		Object.assign(this.settings.license, {
			planName: 'Enterprise',
			consumerId: 'enterprise',
			environment: 'production',
		});

		// refresh enterprise status
		Object.assign(this.settings.enterprise, {
			sharing: true,
			logStreaming: true,
			ldap: true,
			saml: true,
			advancedExecutionFilters: true,
			variables: true,
			sourceControl: true,
			externalSecrets: true,
			showNonProdBanner: false,
			debugInEditor: true,
			binaryDataS3: true,
			workflowHistory: true,
			workerView: true,
			advancedPermissions: true,
			auditLogs: true,
			projects: {
				team: {
					limit: 999999,
				},
			},
		});

		// Always enable SSO features
		Object.assign(this.settings.sso.ldap, {
			loginLabel: getLdapLoginLabel(),
			loginEnabled: true,
		});

		Object.assign(this.settings.sso.saml, {
			loginLabel: 'SAML 2.0',
			loginEnabled: true,
		});

		// Set high limits for variables
		this.settings.variables.limit = 999999;

		// Enable workflow history
		Object.assign(this.settings.workflowHistory, {
			pruneTime: -1,
			licensePruneTime: -1,
		});

		// Enable all AI features
		this.settings.aiAssistant.enabled = true;
		this.settings.askAi.enabled = true;
		this.settings.aiCredits.enabled = true;
		this.settings.aiCredits.credits = 999999;

		this.settings.mfa.enabled = config.get('mfa.enabled');

		this.settings.executionMode = config.getEnv('executions.mode');

		this.settings.binaryDataMode = config.getEnv('binaryDataManager.mode');

		this.settings.enterprise.projects.team.limit = this.license.getTeamProjectLimit();

		return this.settings;
	}

	private writeStaticJSON(name: string, data: INodeTypeBaseDescription[] | ICredentialType[]) {
		const { staticCacheDir } = this.instanceSettings;
		const filePath = path.join(staticCacheDir, `types/${name}.json`);
		const stream = createWriteStream(filePath, 'utf-8');
		stream.write('[\n');
		data.forEach((entry, index) => {
			stream.write(JSON.stringify(entry));
			if (index !== data.length - 1) stream.write(',');
			stream.write('\n');
		});
		stream.write(']\n');
		stream.end();
	}

	private overwriteCredentialsProperties() {
		const { credentials } = this.loadNodesAndCredentials.types;
		const credentialsOverwrites = this.credentialsOverwrites.getAll();
		for (const credential of credentials) {
			const overwrittenProperties = [];
			this.credentialTypes
				.getParentTypes(credential.name)
				.reverse()
				.map((name) => credentialsOverwrites[name])
				.forEach((overwrite) => {
					if (overwrite) overwrittenProperties.push(...Object.keys(overwrite));
				});

			if (credential.name in credentialsOverwrites) {
				overwrittenProperties.push(...Object.keys(credentialsOverwrites[credential.name]));
			}

			if (overwrittenProperties.length) {
				credential.__overwrittenProperties = uniq(overwrittenProperties);
			}
		}
	}
}
