***********
Webapp mode
***********

You can configure Horus as a web server to offer a Web App to your users. In order to configure the Web App mode, you need to setup a horus.config.json file in the current working directory.
The configuration file is a JSON file that contains the server configuration and the user management settings.

Essential server configuration like the host and the port are defined as command line arguments or environment variables. Run `horus --help` to see the available options.

You can set a custom logo for the Web App by placing a file called "logo.png" in the current working directory.

.. WARNING::
    A SLURM installation is required in order to submit flows using Web App mode.

Configuration File
==================

This document describes the configuration options available in the JSON configuration file.

.. code-block:: javascript

    {
      // Host and port where the server will listen
      "host": "yourIP",
      "port": 3000,
      // External URL. Will be used in mail activation links and other places
      "externalURL": "app.horus.com",
      // Company name
      companyName: "Horus",
      // App name
      appName: "Horus",
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
        // Quotas for the anonymus users. Only the maximum number of flows can be set
        maxFlowsAnonymous: 10,
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
          // In the body, the link to activate the account is replaced by %link%
          body: "Welcome to Horus! To activate your account, click on the following link: <a href=\"%link%\">Activate account</a>"
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
          },
          // Extra fields for the user table, those work as the PluginVariables of HorusAPI
          // id, password, email, activated, register_date, last_login, admin, user_group are present by default.
          // Groups are useful because you can define which blocks, plugins or extensions are available for each group.
          // When not using requireActivation, the activated field is automatically assigned to "true".
          // Here are some examples of extra fields:
          extraFields: [
            {
              id: "name",
              name: "First name",
              type: "string",
            },
            {
              id: "last_name",
              name: "Last name",
              type: "string",
            },
            {
              id: "ocuppation",
              name: "Ocuppation",
              type: "string_list",
              allowedValues: ["student", "teacher", "researcher", "other"],
            },
          ],
        },
      },
    }

Configuration Options
---------------------

1. **Server Configuration**:

   - `host`: The host where the server will listen.
   - `port`: The port where the server will listen.
   - `externalURL`: The external URL of the server.
   - `companyName`: The name of the company.
   - `appName`: The name of the app.

2. **User Management**:

   - `appSupportDir`: The path where user data is stored.

   - `requireRegistration`: Boolean indicating if user registration is required.
   
   - `requireActivation`: Boolean indicating if user email confirmation is required.

   - `allowDemoUser`: Boolean indicating if users can use the app in demo mode.

   - `deleteInterval`: Time in days to remove the anonymus user data.

   - `maxFlowsAnonymous`: Maximum number of flows allowed for anonymus users.

   - `mailServer`: Configuration options for the mail server.

3. **Mail Server Configuration**:

   - `host`: The SMTP server hostname.

   - `port`: The SMTP server port.

   - `secure`: Boolean indicating if a secure connection is required.

   - `auth`: Authentication details for the mail server.

4. **Database Configuration**:

   - `path`: Path to the SQLite database file.

   - `extraFields`: Additional fields for the user table.

5. **User Storage Quotas**:

  .. note::
      Set the quotas to 0 to disable the limit.

   - `maxStorage`: Maximum storage allowed per user (in MB).

   - `maxFlows`: Maximum number of flows allowed per user.

   - `maxTime`: Maximum computation hours allowed per user.
