export const config = {
  // Host to listen to
  host: "localhost",
  // Port to listen to
  port: 3000,
  // External URL. Will be used in mail activation links and other places
  externalURL: "app.horus.com",
  // Company name
  companyName: "Horus",
  // App name to display instead of "Horus"
  appName: "My App Name",
  // Wether to allow users to configure and use remotes
  allowRemotes: false,
  // Allow custom blocks definition. WARNING: Custom blocks allow for the execution of arbitrary code
  // use at your own risk. If enabled, only admins can create custom blocks. Custom blocks loaded in the
  // custom blocks folder will be available to all users
  allowCustomBlocks: false,
  // CORS configuration, by default, all origins are allowed
  cors: {
    origins: "*",
    resources: { "/*": { origins: "*" } },
  },
  // User management - If defined the "webapp" mode, then the user management is required
  userManagement: {
    // Path where the user data is stored. A folder for each user is created inside this path
    appSupportDir: "horus",
    // If false, then users are not required to register, and their session is not stored
    // All calculations are done on the fly and removed after the user leaves the page
    requireRegistration: true,
    // If user registration is required, you may require them to confirm their email before using the app
    requireActivation: true,
    // AdminTools is a panel available to WebApp administrators (available at Profile -> AdminTools). If you want to disable this panel entirely,
    // set this option to true
    disableAdminTools: false,
    // If user registration is required, you may allow them to use the app in demo mode. Which means they can use the app without registering
    // But they cannot send any flow and their session is removed after they leave the page
    allowDemoUser: true,
    // When not using requireRegistration, you may want to remove automatically
    // the anonymus user data after a certain time. Specify the time in days
    deleteInterval: 1,
    // Enforces that workflows that execute commands require local credentials in webapp mode.
    requireLocalCredentials: true,
    // If requireRegistration is false, then you may want to limit the number of flows that an anonymous user can send
    // This is different from the "database" configuration in the sense that anonymous users cannot be tracked. This
    // configuration will only apply to non-registered users, as registered ones have the "quotas". This won't apply
    // in any case to webapps that have the requireRegistration set to true, as demo users cannot send calculations.
    requireLocalCredentials: true,
    // Enforces that workflows that execute commands require local credentials in webapp mode.
    anonymousQuotas: {
      maxFlows: 10,
      maxTemplates: 10,
      maxStorage: 500,
      maxTime: 100,
    },
    // This setting regulates the behaviour of the File Picker system for variables like "folder" or "file"
    fileManagement: {
      // If true, then users can access the entire file system. 
      // Otherwise, they can only access their own user folder
      allowFullFileSystemAccess: true,
      // Whether to allow users to upload files
      allowUpload: true,
      // For EACH file that they upload, the maximum size (in MB)
      maxUploadSize: 500,
      // If files / folders can be downloaded from the file picker
      allowDownload: true,
      // If files / folders can be deleted from the file picker
      allowDelete: true,
      // If users can create new folders with the "New folder" button
      allowNewFolder: true,
    },
    // Forbid blocks from being used by users. This configuration only applies here when requireRegistration is set to false
    // Otherwise, you can modify the allowed blocks in the Admin Tools panel.
    // This is just an array with the block IDs. Block IDs can be found in the block registry panel.
    forbiddenBlocks: ["horus.code", "horus.getData"],
    // Mail server configuration
    mailServer: {
      host: "smtp.mail.com",
      port: 587,
      secure: "SSL_TLS", // Allowed none, STARTTLS and SSL_TLS
      auth: {
        user: "horus@mail.com",
        password: "password",
      },
      activateSubject: "Horus account activation",
      activateBody:
        "Welcome to Horus! To activate your account, click on the following link: <a href='%link%'>Activate account</a>",
      resetSubject: "Horus account password reset",
      resetBody:
        "Reset your password on the following link: <a href='%link%'>Reset password</a>",
    },

    // Database configuration. Horus works with a SQLlite database.
    database: {
      path: "horus.db",
      secretKey: "secret",
      // User storage quotas
      defaultQuotas: {
        // Storage (in MB)
        maxStorage: 100,
        // Number of flows
        maxFlows: 10,
        // Number of templates
        maxTemplates: 10,
        // Max computation hours
        maxTime: 100,
        // When to reset the computation hours (in days or "null" to never reset)
        resetTime: null,
      },
      // Extra fields for the user table, those work as the PluginVariables of HorusAPI
      // id, password, email, activated, register_date, last_login, admin, user_group are present by default.
      // Groups are useful because you can define which blocks, plugins or extensions are available for each group.
      // When not using requireActivation, the activated field is automatically assigned to "true".
      // Here are some examples of extra fields:
      extraFields: [
        {
          id: "name",
          name: "First Name",
          type: "string",
        },
        {
          id: "surname",
          name: "Last Name",
          type: "string",
        },
        {
          id: "ocuppation",
          name: "Ocuppation",
          type: "string[]",
          allowedValues: ["Student", "Teacher", "Researcher", "Other"],
        },
      ],
    },
  },
};
