import { getBaseURL, horusGet } from "@/Utils/utils";
import { DetailedHTMLProps } from "react";

export default function Logo(
  props: DetailedHTMLProps<
    React.ImgHTMLAttributes<HTMLImageElement>,
    HTMLImageElement
  >
) {
  return (
    <img
      src={getBaseURL("/api/logo")}
      alt="logo"
      {...props}
      style={{
        objectFit: "contain",
        ...props.style
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
