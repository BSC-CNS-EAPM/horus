# Horus

Horus is a cross-platform graphical user interface of the NBDSuite, a collection of tools developed by Nostrum Biodiscovery to help scientists in the process of drug discovery.

<p align="center">
<img width="160" alt="horus" src="https://github.com/chdominguez/Horus/assets/34599976/3300d61f-b6d9-4765-b202-7a2a684a91dc">
<img height="160" alt="nostrum" src="https://github.com/chdominguez/Horus/assets/34599976/7f8e1cf9-21e0-468f-98ac-2c0e8673e33e">
<p\>

# Installation

## Linux

1. Download the latest Linux release from the [releases page]()
2. Unzip the application on your usual applications folder
3. Run the application by executing the `Horus` file:

   ```
   ./Horus
   ```

## macOS

1. Download the latest macOS release from the [releases page]()
2. Open the .dmg file and drag the application to your usual applications folder
3. Run the application by double clicking on the `Horus` icon in your applications folder

## Windows

Unfortunately, a Windows version cannot be provided at the moment. However, you can run the web version of the application by following the instructions below.

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

   sudo apt install nodejs
   ```

4. Optionally, install the alien package converter to generate the .rpm file from the .deb file for EL systems.

   ```
   sudo apt install alien
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

# Development environment

## Regular dependencies

Once all the dependencies are installed, you can create a virtual environment with the following command:

```
npm run requirements
```

This will install all the required node packages and will create a new conda environment named 'horus' with all the needed python packages.

## Optional dependencies

### NBDSuite
You will need to install NBDSuite manually. You can download the latest release from the [NBDSuite releases page](https://github.com/NBDsoftware/NBDSuite/releases). Once downloaded, unzip the file and run the following command:

```
python -m pip install nbdsuite-<version>.tar.gz
```

### Peleffy

You will need to install Peleffy from source into the environment if you have an Apple Silicon Mac. To do so, follow these steps:

1. Clone the peleffy repository:

   ```
   git clone https://github.com/martimunicoy/peleffy/tree/master
   ```

2. Checkout the latest tag

   ```
   git checkout tags/v1.4.4
   ```

3. Install peleffy

   ```
   python -m pip install .
   ```

Otherwise you can follow the instructions here:

https://martimunicoy.github.io/peleffy/installation.html

### AmberTools

If you have an Apple Silicon Mac, you will need to install AmberTools from source into the environment. To do so, follow these steps:

TODO

Otherwise you can install directly from conda:

```
conda install -c conda-forge ambertools
```

# Run in development

To run the application in development mode, make sure you are inside the `horus` environment and run the following command:

```
python Horus.py --debug
```

You can also run the app in server development mode (preferred):

```
python Horus.py --debug --server
```

In debug mode, the app is accessible in the following url: [http://127.0.0.1:5001](http://127.0.0.1:5001)

# Building

1. Activate the `horus` environment

   ```
   conda activate horus
   ```

2. Make sure you are on the root folder of the project and run the following command:

   ```
   npm run build
   ```

   The compiled application will be located in the `dist` folder.

   You can clean all the produced files during the build process with:

   ```
   npm run clean
   ```
