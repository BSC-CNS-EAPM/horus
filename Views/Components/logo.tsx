import { horusGet } from "@/Utils/utils";

export default function Logo(props: JSX.IntrinsicElements["img"]) {
  return (
    <img
      src="/api/logo"
      alt="logo"
      {...props}
      style={{
        objectFit: "contain",
        ...props.style,
      }}
    />
  );
}

export function getPluginLogo({ pluginID }: { pluginID: string }) {
  return horusGet(`/api/plugins/logo?pluginID=${pluginID}`)
    .then((res) => res.json())
    .then((data) => {
      if (data?.logo) {
        return data.logo;
      }

      return null;
    })
    .catch((err) => {
      console.error(err);
      return null;
    });
}
