# Horus

Horus is a cross-platform graphical user interface of the NBDSuite, a collection of tools developed by Nostrum Biodiscovery to help scientists in the process of drug discovery.

<p align="center">
<img width="160" alt="horus" src="https://github.com/NBDsoftware/horus/assets/34599976/d9c603f7-11c6-4f2b-9cd1-6bba5b72bf3f">
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

   1.1. Debian based

   ```
   sudo apt install libgirepository1.0-dev \
   gcc g++ \
   python3-gi \
   python3-gi-cairo \
   gir1.2-gtk-4.0 \
   gir1.2-webkit2-4.0 \
   libgtk-4-dev
   ```

   1.2. RedHat based

   ```
   sudo dnf install redhat-lsb-core \
   gobject-introspection-devel \
   cairo-gobject-devel \
   pkg-config \
   python3-devel \
   gtk3 \
   gtk3-devel \
   python3-gobject \
   webkit2gtk3 \
   webkit2gtk3-devel \
   libcanberra-gtk3 \
   PackageKit-gtk3-module \
   glib2-devel dbus-glib-devel
   ```

   1.3. Optional, QT5

   If you want to compile a QT5 version of Horus, remember to install the QT5 library alongside with python bindings.

2. Install Miniconda

   ```
   wget https://repo.anaconda.com/miniconda/Miniconda3-latest-Linux-x86_64.sh -O ~/miniconda.sh && bash ~/miniconda.sh
   ```

3. Install Nodejs

   3.1. Debian based

   ```
   curl -sL https://deb.nodesource.com/setup_18.x -o /tmp/nodesource_setup.sh

   sudo bash /tmp/nodesource_setup.sh

   sudo apt install nodejs
   ```

   3.2. RedHat based

   ```
   curl -sL https://rpm.nodesource.com/setup_18.x -o /tmp/nodesource_setup.sh

   sudo bash /tmp/nodesource_setup.sh

   sudo dnf install nodejs
   ```

4. In RedHat systems, remmeber to install the RPM tools to build the .RPM package

   ```
   sudo dnf install -y rpmdevtools rpmlint
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

# Run in development

To run the application in development mode, make sure you are inside the `horus` environment and run the following command:

```
python Horus.py --debug
```

You can also run the app in server development mode (preferred):

```
python Horus.py --debug --server
```

The app can also be run on "Browser mode" which is useful for systems that do not have GPU acceleration:

```
python Horus.py --browser
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

# Distributing

```
npm run distribute
```

This will create a .dmg file on macOS, a .deb on Debian based systems and a .rpm file on RedHat based systems.

# Horus with QT

Horus can be used with QT instead of GTK (useful for older distributions). Install the required QT5 libraries along with Python bindings to compile a QT version of the app. Currently, the Rocky version of Horus is built with QT automatically.

You can force Horus to run with QT using the following flag for the compiled app:

```
./Horus --gui=qt
```

Or using an environment variable:

```
export HORUS_GUI=qt
```

For systems with limited graphics capabilities, in cases where QT or GTK are unable to establish a GL context, yet standard web browsers such as Firefox or Chrome can, Horus offers the option of running in browser mode. This mode is essential for utilizing Horus in `Nice`.

```
./Horus -b
```

or

```
./Horus --browser
```

Furthermore, it is recommended for edge cases where GPU acceleration is not directly accessible, to force QT with software rendering, alognside with browser mode. For running Horus inside `Nice` the final procedure will be:

```
export HORUS_GUI=qt
export QT_QUICK_BACKEND=software
./Horus --browser
```
