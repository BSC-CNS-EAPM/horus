export const config = {
  // External URL. Will be used in mail activation links and other places
  externalURL: "app.horus.com",
  // Company name
  companyName: "Horus",
  // User management - If defined the "webapp" mode, then the user management is required
  userManagement: {
    // Path where the user data is stored. A folder for each user is created inside this path
    appSupportDir: "horus",
    // If false, then users are not required to register, and their session is not stored
    // All calculations are done on the fly and removed after the user leaves the page
    requireRegistration: true,
    // If user registration is required, you may require them to confirm their email before using the app
    requireActivation: true,
    // If user registration is required, you may allow them to use the app in demo mode. Which means they can use the app without registering
    // But they cannot send any flow and their session is removed after they leave the page
    allowDemoUser: true,
    // When not using requireRegistration, you may want to remove automatically
    // the anonymus user data after a certain time. Specify the time in days
    deleteInterval: 1,
    // If requireRegistration is false, then you may want to limit the number of flows that an anonymous user can send
    // This is different from the "database" configuration in the sense that anonymous users cannot be tracked. This
    // configuration will only apply to non-registered users, as registered ones have the "quotas". This won't apply
    // in any case to webapps that have the requireRegistration set to true, as demo users cannot send calculations.
    anonymousQuotas: {
      maxFlows: 10,
      maxStorage: 500,
      maxTime: 100,
    },
    // This setting regulates the behaviour of the filepicker system for variables like "folder" or "file"
    fileManagement: {
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
    // Mail server configuration
    mailServer: {
      host: "smtp.mail.com",
      port: 587,
      secure: false,
      auth: {
        user: "horus@mail.com",
        password: "password",
      },
      subject: "Horus account activation",
      body: 'Welcome to Horus! To activate your account, click on the following link: <a href="%link%">Activate account</a>',
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
          type: "string_list",
          allowedValues: ["Student", "Teacher", "Researcher", "Other"],
        },
      ],
    },
  },
};
