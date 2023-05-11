# Horus
Horus is a cross-platform graphical user interface of the NBDSuite, a collection of tools developed by Nostrum Biodiscovery to help scientists in the process of drug discovery.

# Installation
## Linux
1. Download the latest release from the [releases page]()
2. Unzip the application on your usual applications folder
3. Run the application by executing the `Horus` file:

    ```
    ./Horus
    ```
        

# Development dependencies
## Linux
1. Install required libraries for GTK:

    ```
    sudo apt install libgirepository1.0-dev gcc libgtk-3-dev
    ```

2. Install Miniconda

    ```
    wget https://repo.anaconda.com/miniconda/Miniconda3-latest-Linux-x86_64.sh -O ~/miniconda.sh && bash ~/miniconda.sh
    ```

3. Install Nodejs

    ```
    curl -sL https://deb.nodesource.com/setup_18.x -o /tmp/nodesource_setup.sh

    sudo bash /tmp/nodesource_setup.sh

    sudo apt install nodejs@18
    ```

## macOS
1. Install Miniconda

    ```
    brew install --cask miniconda
    ```

2. Install Nodejs

    ```
    brew install nodejs
    ```
 
## Windows
1. Install Visual Studio Build Tools (C++ Desktop Development)

    https://visualstudio.microsoft.com/thank-you-downloading-visual-studio/?sku=BuildTools&rel=16

2. Install Miniconda

    https://docs.conda.io/projects/conda/en/stable/user-guide/install/windows.html

3. Install Nodejs

    Get the 18.x.x LTS version from:
    https://nodejs.org/en/download

# Development environment
Once all the dependencies are installed, you can create a virtual environment with the following command:

```
npm run requirements
```

This will install all the required node packages and will create a new codna environment named 'horus' with all the needed python packages.

# Run in development
To run the application in development mode, make sure you are inside the `horus` environment and run the following command:

```
python Horus.py
```

# Building

1. Download the latest code release from the [releases page]()

2. Unzip the downloaded file and navigate to the unzipped folder

3. Activate the `horus` environment

    ```
    conda activate horus
    ```

4. Run the build command

    ```
    npm run build
    ```

The compiled application will be located in the `dist` folder.