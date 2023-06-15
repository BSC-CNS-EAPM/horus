from HorusAPI import (
    Plugin,
    PluginBlock,
    PluginVariable,
    VariableTypes,
    PluginConfig,
)

plugin = Plugin(id="ssh")

plugin.info = {
    "name": "SSH",
    "description": "The SSH plugin for Horus",
    "author": "Nostrum Biodiscovery",
    "version": "0.0.1",
    "dependencies": ["paramiko"],
}

command = PluginVariable(
    id="command",
    name="Command",
    description="The command to run.",
    type=VariableTypes.STRING,
    defaultValue="hostname",
)

sendFolder = PluginVariable(
    id="sendFolder",
    name="Send folder",
    description="Wether to upload the project folder.",
    type=VariableTypes.BOOLEAN,
    defaultValue=True,
)

folderDestination = PluginVariable(
    id="folderDestination",
    name="Folder destination",
    description="The destination folder.",
    type=VariableTypes.STRING,
    defaultValue="/home/username/",
)

hostname = PluginVariable(
    id="hostname",
    name="Hostname",
    description="The hostname.",
    type=VariableTypes.STRING,
    defaultValue="localhost",
)

username = PluginVariable(
    id="username",
    name="Username",
    description="The username.",
    type=VariableTypes.STRING,
    defaultValue="",
)

password = PluginVariable(
    id="password",
    name="Password",
    description="The password.",
    type=VariableTypes.STRING,
    defaultValue="",
)

proxycommand = PluginVariable(
    id="proxycommand",
    name="Proxy command",
    description="The proxy command.",
    type=VariableTypes.STRING,
    defaultValue="",
)

ssh_key = PluginVariable(
    id="ssh_key",
    name="SSH key path",
    description="The SSH key path.",
    type=VariableTypes.STRING,
    defaultValue="",
)

config = PluginConfig(
    name="SSH",
    description="SSH configuration.",
    variables=[hostname, username, password, proxycommand, ssh_key],
)


def sendScript(block: PluginBlock):
    import paramiko
    import os

    print("Sending script...")
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    hostname = block.configs["hostname"]
    username = block.configs["username"]
    password = block.configs["password"]
    key_file = block.configs["ssh_key"]
    proxycommand = block.configs["proxycommand"]

    if os.path.exists(key_file):
        ssh.connect(
            hostname,
            username=username,
            key_filename=key_file,
            sock=paramiko.ProxyCommand(proxycommand),
        )
    else:
        ssh.connect(
            hostname,
            username=username,
            password=password,
            sock=paramiko.ProxyCommand(proxycommand),
        )

    upload_folder = block.variables["sendFolder"]
    if upload_folder:
        print("Uploading folder...")
        folder = block.variables["folderDestination"]
        current_folder = os.getcwd()
        # Upload the folder
        sftp = ssh.open_sftp()
        for root, dirs, files in os.walk(current_folder):
            for file in files:
                sftp.put(os.path.join(root, file), os.path.join(folder, file))
            for dir in dirs:
                sftp.mkdir(os.path.join(folder, dir))
        sftp.close()
        print("Folder uploaded.")

    command = block.variables["command"]
    print("Running command...")
    stdin, stdout, stderr = ssh.exec_command(command)
    print(stdout.read())
    print(stderr.read())
    print("Command finished.")
    ssh.close()
    print("Script sent.")


sshblock = PluginBlock(
    name="Send script",
    description="Send a script to a remote server.",
    variables=[command, sendFolder, folderDestination],
    action=sendScript,
)

sshblock.addConfig(config)

plugin.addBlock(sshblock)
