import { License, type FeatureReturnType } from './license';
import { LICENSE_FEATURES, UNLIMITED_LICENSE_QUOTA } from './constants';
import type { BooleanLicenseFeature } from './interfaces';
import { Service } from '@n8n/di';

@Service()
export class CustomLicense extends License {
	isFeatureEnabled(feature: BooleanLicenseFeature) {
		return true; // Enable all features
	}

	isSharingEnabled() {
		return true;
	}
	isLogStreamingEnabled() {
		return true;
	}
	isLdapEnabled() {
		return true;
	}
	isSamlEnabled() {
		return true;
	}
	isAiAssistantEnabled() {
		return true;
	}
	isAskAiEnabled() {
		return true;
	}
	isAiCreditsEnabled() {
		return true;
	}
	isAdvancedExecutionFiltersEnabled() {
		return true;
	}
	isAdvancedPermissionsLicensed() {
		return true;
	}
	isDebugInEditorLicensed() {
		return true;
	}
	isBinaryDataS3Licensed() {
		return true;
	}
	isMultiMainLicensed() {
		return true;
	}
	isVariablesEnabled() {
		return true;
	}
	isSourceControlLicensed() {
		return true;
	}
	isExternalSecretsEnabled() {
		return true;
	}
	isWorkflowHistoryLicensed() {
		return true;
	}
	isAPIDisabled() {
		return false;
	}
	isWorkerViewLicensed() {
		return true;
	}
	isProjectRoleAdminLicensed() {
		return true;
	}
	isProjectRoleEditorLicensed() {
		return true;
	}
	isProjectRoleViewerLicensed() {
		return true;
	}
	isCustomNpmRegistryEnabled() {
		return true;
	}

	getUsersLimit() {
		return UNLIMITED_LICENSE_QUOTA;
	}
	getApiKeysPerUserLimit() {
		return UNLIMITED_LICENSE_QUOTA;
	}
	getTriggerLimit() {
		return UNLIMITED_LICENSE_QUOTA;
	}
	getVariablesLimit() {
		return UNLIMITED_LICENSE_QUOTA;
	}
	getAiCredits() {
		return UNLIMITED_LICENSE_QUOTA;
	}
	getWorkflowHistoryPruneLimit() {
		return UNLIMITED_LICENSE_QUOTA;
	}
	getTeamProjectLimit() {
		return UNLIMITED_LICENSE_QUOTA;
	}
	getPlanName() {
		return 'Enterprise';
	}

	// Override manager-related methods to prevent license checks
	async init() {
		return;
	}
	async activate() {
		return;
	}
	async reload() {
		return;
	}
	async renew() {
		return;
	}
	async shutdown() {
		return;
	}
	async reinit() {
		return;
	}
	getManagementJwt() {
		return '';
	}
	getMainPlan() {
		return undefined;
	}
	getConsumerId() {
		return 'enterprise';
	}
	getCurrentEntitlements() {
		return [];
	}
	getFeatureValue<T extends keyof FeatureReturnType>(feature: T): FeatureReturnType[T] {
		if (feature === 'planName') return 'Enterprise' as FeatureReturnType[T];
		return UNLIMITED_LICENSE_QUOTA as FeatureReturnType[T];
	}
	isWithinUsersLimit() {
		return true;
	}
	getInfo() {
		return 'Enterprise';
	}
}
