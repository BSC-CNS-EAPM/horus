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
