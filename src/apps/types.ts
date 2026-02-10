/**
 * App system types and interfaces
 */

/**
 * App manifest - extends package.json with Nodra-specific metadata
 */
export interface AppManifest {
	/** App name (from package.json) */
	name: string;

	/** App version (from package.json) */
	version: string;

	/** App description */
	description?: string;

	/** App author */
	author?: string;

	/** Nodra-specific metadata */
	nodra?: {
		/** List of apps this app depends on */
		depends_on?: string[];

		/** App title (human-readable) */
		title?: string;

		/** App module/category */
		module?: string;

		/** App publisher */
		publisher?: string;

		/** App license */
		license?: string;
	};
}

/**
 * App metadata - runtime representation of an installed app
 */
export interface App {
	/** App name */
	name: string;

	/** App version */
	version: string;

	/** App path on filesystem */
	path: string;

	/** App manifest */
	manifest: AppManifest;

	/** Installation status */
	installed: boolean;

	/** Enabled/disabled status */
	enabled: boolean;

	/** List of DocTypes provided by this app */
	doctypes: string[];
}

/**
 * App installation options
 */
export interface InstallOptions {
	/** Skip dependency resolution */
	skipDependencies?: boolean;

	/** Force reinstall */
	force?: boolean;
}

/**
 * App removal options
 */
export interface UninstallOptions {
	/** Remove DocType data */
	removeData?: boolean;

	/** Force removal even if other apps depend on it */
	force?: boolean;
}

/**
 * App loader interface
 */
export interface AppLoader {
	/**
	 * Load app from directory
	 */
	load(appPath: string): Promise<App>;

	/**
	 * Load all apps from apps directory
	 */
	loadAll(appsDir: string): Promise<App[]>;

	/**
	 * Get DocTypes for an app
	 */
	getDocTypes(app: App): Promise<string[]>;
}

/**
 * App installer interface
 */
export interface AppInstaller {
	/**
	 * Install an app
	 */
	install(app: App, options?: InstallOptions): Promise<void>;

	/**
	 * Uninstall an app
	 */
	uninstall(appName: string, options?: UninstallOptions): Promise<void>;

	/**
	 * Check if app is installed
	 */
	isInstalled(appName: string): Promise<boolean>;
}

/**
 * App registry interface - tracks installed apps
 */
export interface AppRegistry {
	/**
	 * Register an installed app
	 */
	register(app: App): void;

	/**
	 * Unregister an app
	 */
	unregister(appName: string): void;

	/**
	 * Get an app by name
	 */
	get(appName: string): App | undefined;

	/**
	 * Get all registered apps
	 */
	getAll(): App[];

	/**
	 * Check if app is registered
	 */
	has(appName: string): boolean;
}

/**
 * Dependency resolution result
 */
export interface DependencyResolution {
	/** Apps in installation order */
	installOrder: string[];

	/** Missing dependencies */
	missing: string[];

	/** Circular dependencies detected */
	circular: string[][];
}
