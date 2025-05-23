// React
import { useCallback, useEffect, useState } from "react";

// Ignore React18 errors until frontend-rewrite
// @ts-ignore
import { render, unmountComponentAtNode } from "react-dom";

// Types
import { Flow } from "../FlowBuilder/flow.types";

// Horus utils
import { horusDelete, horusGet } from "../../Utils/utils";

// Components
import RotatingLines from "../RotatingLines/rotatinglines";
import { BlurredModal, HorusLink } from "../reusable";

// Icons
import TrashIcon from "../Toolbar/Icons/Trash";
import OpenFlowIcon from "../Toolbar/Icons/Open";

// CSS
import "./templates.css";
import { useAlert } from "../HorusPrompt/horus_alert";
import { SearchComponent } from "../Search/Search";

function useTemplates() {
  const [fetchingTemplates, setFetchingTemplates] = useState(false);
  const [templates, setTemplates] = useState<Flow[]>([]);
  const [filteredTemplates, setFilteredTemplates] = useState<Flow[]>([]);
  const [filterTerm, setFilteredTerm] = useState("");

  const filterTemplates = useCallback(() => {
    setFilteredTemplates(
      templates.filter((t) =>
        t.name.toLowerCase().includes(filterTerm.toLowerCase())
      )
    );
  }, [filterTerm, templates]);

  const horusAlert = useAlert();

  const getTemplates = async () => {
    setFetchingTemplates(true);
    const response = await horusGet("/api/templates");

    const data = await response.json();

    if (!data.ok) {
      await horusAlert(data.msg);
    } else {
      setTemplates((data?.templates as Flow[]) ?? []);
    }
    setFetchingTemplates(false);
  };

  useEffect(() => {
    getTemplates();
  }, []);

  useEffect(() => {
    filterTemplates();
  }, [filterTerm, filterTemplates]);

  return {
    templates: filteredTemplates,
    getTemplates,
    fetchingTemplates,
    setFilteredTerm,
  };
}

export function TemplatesView() {
  const { templates, getTemplates, fetchingTemplates, setFilteredTerm } =
    useTemplates();

  if (fetchingTemplates) {
    return (
      <div className="flex flex-col justify-center items-center m-auto h-full">
        <RotatingLines />
        Loading...
      </div>
    );
  }

  return (
    <div className="overflow-hidden w-full">
      <div className="flex flex-col">
        <div className="plugin-manager-title flex">
          <div
            className="
        text-2xl
        font-semibold
        flex
        justify-center
        items-center
        gap-2
        ml-2
      "
          >
            Flow templates
          </div>
          <div className="flex flex-row flex-wrap justify-center gap-2 mr-2">
            <SearchComponent
              placeholder="Search templates..."
              onChange={(e) => {
                setFilteredTerm(e.target.value);
              }}
            />
          </div>
        </div>
        <div
          className="w-full h-full flex flex-col items-center justify-center"
          style={{
            color: "var(--digital-grey-IV)",
          }}
        >
          {templates?.length === 0 ? (
            <NoTemplates />
          ) : (
            <div className="templates-table w-full p-2 svg-container">
              <div className="header-row">Template name</div>
              <div className="header-row">Creation date</div>
              <div className="header-row">Open</div>
              <div className="header-row">Delete</div>
              <hr className="p-0 m-0 w-full"></hr>
              <hr className="p-0 m-0 w-full"></hr>
              <hr className="p-0 m-0 w-full"></hr>
              <hr className="p-0 m-0 w-full"></hr>
              {templates.map((t) => {
                return (
                  <Template
                    key={t.savedID}
                    flow={t}
                    getTemplates={getTemplates}
                  />
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function NoTemplates() {
  return <span className="m-4">No templates</span>;
}

export function Template({
  flow,
  getTemplates,
}: {
  flow: Flow;
  getTemplates: () => Promise<void>;
}) {
  return (
    <>
      <div className="text-center">{flow.name}</div>
      <div className="text-center">{flow.date}</div>
      <HorusLink to={`/flow?open=true&flowID=${flow.savedID}&template=true`}>
        <OpenFlowIcon className="w-6 h-6 cursor-pointer" />
      </HorusLink>
      <TrashIcon
        onClick={() => {
          DeleteTemplateModal({ flow, getTemplates });
        }}
        className="w-6 h-6 cursor-pointer"
        style={{
          color: "red",
        }}
      />
    </>
  );
}

function DeleteTemplateModal({
  flow,
  getTemplates,
}: {
  flow: Flow;
  getTemplates: () => Promise<void>;
}) {
  // Attach the modal to the body of the document
  const modal = document.createElement("div") as HTMLDivElement;
  modal.id = "delete-flow-modal";
  document.body.appendChild(modal);
  // Render the modal
  render(
    <_DeleteTemplateModal flow={flow} getTemplates={getTemplates} />,
    modal
  );
}

function _DeleteTemplateModal({
  flow,
  getTemplates,
}: {
  flow: Flow;
  getTemplates: () => Promise<void>;
}) {
  const [isDeleting, setIsDeleting] = useState(false);

  // Get the modal element
  const modal = document.getElementById("delete-flow-modal") as HTMLDivElement;

  const horusAlert = useAlert();

  const removeFlow = async () => {
    setIsDeleting(true);

    try {
      const response = await horusDelete({
        url: "/api/templates",
        body: {
          templateID: flow.savedID,
        },
      });

      const data = await response.json();

      if (!data.ok) {
        await horusAlert("Error deleting template: " + data.msg);
      } else {
        // Get the flows again
        await getTemplates();

        setIsDeleting(false);

        unmountComponentAtNode(modal);
        modal.remove();
      }
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <BlurredModal show={true} onHide={() => {}}>
      <div className="p-2 flex flex-col gap-2">
        <div
          className="text-xl font-semibold flow-title"
          style={{
            height: "unset",
          }}
        >
          Delete template
        </div>
        <hr
          style={{
            width: "100%",
            margin: "0 0",
          }}
        ></hr>
        <p className="text-center">
          <div>Are you sure you want to delete this template?</div>
        </p>
        <p className="text-center font-semibold">{flow.name}</p>
        <div className="flex flex-row justify-center gap-2">
          {isDeleting ? (
            <>
              <RotatingLines />
            </>
          ) : (
            <>
              <button
                className="app-button btn-danger"
                style={{
                  color: "var(--danger-red)",
                }}
                onClick={() => {
                  removeFlow();
                }}
              >
                Delete
              </button>
              <button
                className="app-button btn-secondary"
                onClick={() => {
                  unmountComponentAtNode(modal);
                  modal.remove();
                }}
              >
                Cancel
              </button>
            </>
          )}
        </div>
      </div>
    </BlurredModal>
  );
}
