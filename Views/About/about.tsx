import { useEffect, useState } from "react";

// Horus web-server utils
import { horusGet } from "../Utils/utils";

// @ts-ignore
import ExternalIcon from "@components/Toolbar/Icons/External";
import LogFile from "@components/Toolbar/Icons/LogFile";
import AppButton from "@components/appbutton";
import { BlurredModal } from "@components/reusable";
import {
  Center,
  Container,
  Loader,
  Paper,
  Stack,
  Text,
  TypographyStylesProvider,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { useQuery } from "@tanstack/react-query";
import HorusLogo from "../../Resources/horus.png";
import RotatingLines from "../Components/RotatingLines/rotatinglines";
import { marked } from "marked";

type AppInfo = {
  APP_VERSION: string;
  platform?: string;
  debug?: boolean;
  mode?: "app" | "server" | "webapp" | "browser" | "unknown";
  appSupportDir?: string;
  PYTHON_VERSION?: string;
};

export async function getAppInfo(): Promise<AppInfo> {
  const response = await horusGet("/api/version");
  if (!response.ok) {
    throw new Error("Error getting application info");
  }
  const data = await response.json();
  if (!data.ok) {
    throw new Error("Error getting application info: " + data.msg);
  }
  return data.appINFO;
}

export default function About() {
  const [appInfo, setAppInfo] = useState<AppInfo>({} as AppInfo);

  const [gettingInfo, setGettingInfo] = useState<boolean>(true);

  const getVersion = async () => {
    setGettingInfo(true);
    getAppInfo()
      .then((info) => {
        setAppInfo(info);
      })
      .catch((error) => {
        alert(error.message);
      })
      .finally(() => {
        setGettingInfo(false);
      });
  };

  const [opened, { open, close }] = useDisclosure(false);

  useEffect(() => {
    getVersion();
  }, []);

  if (gettingInfo) {
    return (
      <div className="grid grid-cols-1 place-items-center h-full">
        <RotatingLines />
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-row flex-wrap justify-around items-center overflow-hidden h-full w-full ">
        <div className="flex flex-col gap-2">
          {appInfo.APP_VERSION && (
            <div className="p-2 horus-container animated-gradient !text-black">
              Version: {appInfo.APP_VERSION}
            </div>
          )}
          {appInfo.platform && (
            <div className="p-2 horus-container animated-gradient !text-black">
              Platform: {appInfo.platform}
            </div>
          )}
          {appInfo.mode && (
            <div className="p-2 horus-container animated-gradient !text-black">
              Mode: {appInfo.mode?.toUpperCase()}
            </div>
          )}
          {appInfo.debug && (
            <div className="p-2 horus-container animated-gradient !text-orange-400 font-semibold">
              Debug mode enabled - Python version: {appInfo.PYTHON_VERSION}
            </div>
          )}
        </div>
        <div className="flex flex-col gap-2">
          <img
            src={HorusLogo}
            alt="Horus Logo"
            className="object-fit m-auto"
            width={100}
          />
          <AppButton action={open}>
            <div className="flex flex-row gap-2 items-center justify-center">
              License <LogFile className="w-5 h-5" />
            </div>
          </AppButton>
          <a
            className="app-button text-black text-decoration-none"
            href="https://horus.bsc.es/"
            target="_blank"
          >
            <div className="flex flex-row gap-2 items-center">
              Learn more about Horus
              <ExternalIcon className="w-5 h-5" />
            </div>
          </a>
        </div>
      </div>
      <BlurredModal
        onHide={close}
        show={opened}
        overRoot
        maxContentSize={{
          width: "90vw",
          height: "90vh",
        }}
      >
        <LicenseView />
      </BlurredModal>
    </>
  );
}

function LicenseView() {
  const { data, isLoading } = useQuery({
    queryKey: [`license`],
    queryFn: () => horusGet("/license").then((r) => r.text()),
  });

  if (isLoading || !data) {
    return (
      <Container size="md" py="xl">
        <Center>
          <Stack align="center" gap="md">
            <Loader color="cyan" size="lg" />
            <Text size="lg" c="dimmed">
              Loading license...
            </Text>
          </Stack>
        </Center>
      </Container>
    );
  }

  return (
    <Container size="md" py="xl">
      <Paper shadow="sm" p="xl" radius="md" withBorder>
        <TypographyStylesProvider>
          <div
            style={{
              userSelect: "auto",
              whiteSpace: "pre-wrap",
              overflowWrap: "break-word",
              wordBreak: "break-word",
              textAlign: "center",
              // fontSize: "20px",
              // fontWeight: 700,
              lineHeight: 1.6,
              color: "var(--mantine-color-text)",
            }}
            dangerouslySetInnerHTML={{
              __html: `
                <style>
                  pre, code {
                    white-space: pre-wrap !important;
                    word-break: break-word;
                    overflow-wrap: break-word;
                    font-size: "14px"
                  }
                  pre {
                    overflow-x: auto;
                    background: var(--mantine-color-gray-0);
                    padding: 1rem;
                    border-radius: 0.5rem;
                    margin: 1rem 0;
                    text-align: left;
                  }
                  code {
                    font-family: monospace;
                  }
                </style>
                ${marked.parse(data)}
              `,
            }}
          />
        </TypographyStylesProvider>
      </Paper>
    </Container>
  );
}
