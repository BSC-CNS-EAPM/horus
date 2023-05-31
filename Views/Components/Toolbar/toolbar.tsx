// Desc: This is the toolbar component
import { Menu, Transition } from '@headlessui/react'
import { Fragment, useEffect, useRef, useState } from 'react'
import { ChevronDownIcon } from '@heroicons/react/20/solid'
import { useNavigate } from 'react-router'
import "../nbdbutton.css"

import "./toolbar.css"
import { none } from 'molstar/lib/mol-model/structure/query/queries/generators'

interface ToolBarItemProps {
    name: string,
    link?: string,
    svgPath: React.ReactNode,
    onClick?: () => void,
    keyShortcut?: string,
}

function ToolBarItem(props: ToolBarItemProps) {

    const navigate = useNavigate()

    const navigateTo = async () => {
        await navigate(props?.link)
    }
    const [active, setActive] = useState(false)

    const handleMouseOver = () => {
        setActive(true)
    }

    const handleMouseLeave = () => {
        setActive(false)
    }

    const [isOpen, setIsOpen] = useState(false)

    // If the path is the same as the link, then the button is active
    useEffect(() => {
        if (window.location.pathname === props.link) {
            setIsOpen(true)
        }
    }, [props.link])

    return (
        <button onMouseOver={handleMouseOver} onMouseLeave={handleMouseLeave}
            className="toolbar-item"
            onClick={
                async () => {
                    await navigateTo()
                    props.onClick?.()
                }
            }
        >
            <MenuIcon active={active || isOpen} svgPath={props.svgPath} />
            <div>
                {props.name}
            </div>
            {props.keyShortcut ? (
                <div className="ml-auto toolbar-item-key-shortcut">
                    {props.keyShortcut}
                </div>
            ) : (
                <></>
            )}

        </button>
    )
}

interface ToolBarMenuProps {
    name: string,
    svgPath: React.ReactNode,
    items?: ToolBarItemProps[],
    link?: string,
}

function ToolbarMenu(props: ToolBarMenuProps) {

    return (
        <div>
            {props.link ? (
                <ToolBarItem {...props} />
            ) : (
                <Menu>
                    <div>
                        <Menu.Button>
                            <ToolBarItem {...props} />
                        </Menu.Button>
                    </div>
                    <Transition
                        as={Fragment}
                        enter="transition ease-out duration-100"
                        enterFrom="transform opacity-0 scale-95"
                        enterTo="transform opacity-100 scale-100"
                        leave="transition ease-in duration-75"
                        leaveFrom="transform opacity-100 scale-100"
                        leaveTo="transform opacity-0 scale-95"
                    >
                        <Menu.Items className="absolute p-md-2 mt-2 w-56 origin-top-left divide-y divide-gray-100 rounded-md bg-white shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
                            {/* // Here the items will be rendered */}
                            {props.items?.map((item) => (
                                <Menu.Item key={item.name}>
                                    {({ close }) => (
                                        <ToolBarItem {...item} onClick={
                                            () => {
                                                item.onClick?.()
                                                close()
                                            }
                                        } />
                                    )}
                                </Menu.Item>
                            ))}
                        </Menu.Items>
                    </Transition>
                </Menu>
            )}
        </div>
    )
}

interface IconProps {
    active: boolean
    svgPath: React.ReactNode
}

const MenuIcon = ({ active, svgPath }: IconProps) => {
    // Colors of the stroke
    const strokeColor = active ? "#1A56DB" : "#1A56DB"

    // Color of the fill
    const fillColor = "transparent"
    return (
        <svg viewBox="0 0 20 20" fill={fillColor} stroke={strokeColor} strokeWidth="2" className="mr-2 h-5 w-5"
            aria-hidden="true">
            {svgPath}
        </svg>
    )
}

function SearchComponent() {
    return (
        <div className="app-button flex flex-row">
            <input type="text" placeholder="Search..." className="toolbar-search" />
            <button>
                <svg xmlns="http://www.w3.org/2000/svg" fill="white" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 15.75l-2.489-2.489m0 0a3.375 3.375 0 10-4.773-4.773 3.375 3.375 0 004.774 4.774zM21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
            </button>
        </div>
    )
}

export default function HorusToolbar() {
    // This is the toolbar component
    // Will lie on top of the page and will contain the
    // user menu, search bar, etc.

    const handleKeyDown = (event: KeyboardEvent) => {
        if (event.key === 't' && event.ctrlKey) {
            toggleConsole();
        }
    }

    const toggleConsole = () => {
        const consoleElement = document.getElementById('console-div');
        const rootRoutes = document.getElementById('root-routes');

        if (consoleElement && rootRoutes) {
            consoleElement.style.display = consoleElement.style.display === 'none' ? 'block' : 'none';
            rootRoutes.classList.toggle('root-routes-console-visible');
            rootRoutes.classList.toggle('root-routes-console-hidden');
        }
    }

    document.addEventListener('keydown', handleKeyDown);

    const menus: ToolBarMenuProps[] = [
        {
            name: 'Home',
            link: '/',
            svgPath: (
                <path fillRule="evenodd" d="M9.293 2.293a1 1 0 011.414 0l7 7A1 1 0 0117 11h-1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-3a1 1 0 00-1-1H9a1 1 0 00-1 1v3a1 1 0 01-1 1H5a1 1 0 01-1-1v-6H3a1 1 0 01-.707-1.707l7-7z" clipRule="evenodd" />
            ),
        },
        {
            name: 'File',
            svgPath: (
                <path d="M3 3.5A1.5 1.5 0 014.5 2h6.879a1.5 1.5 0 011.06.44l4.122 4.12A1.5 1.5 0 0117 7.622V16.5a1.5 1.5 0 01-1.5 1.5h-11A1.5 1.5 0 013 16.5v-13z" />
            ),
            items: [
                {
                    name: 'New',
                    link: '/newjob',
                    svgPath: (
                        <path d="M10.75 4.75a.75.75 0 00-1.5 0v4.5h-4.5a.75.75 0 000 1.5h4.5v4.5a.75.75 0 001.5 0v-4.5h4.5a.75.75 0 000-1.5h-4.5v-4.5z" />
                    ),
                },
                {
                    name: 'Save',
                    link: '/savejob',
                    svgPath: (
                        <>
                            <path d="M2 3a1 1 0 00-1 1v1a1 1 0 001 1h16a1 1 0 001-1V4a1 1 0 00-1-1H2z" />
                            <path fillRule="evenodd" d="M2 7.5h16l-.811 7.71a2 2 0 01-1.99 1.79H4.802a2 2 0 01-1.99-1.79L2 7.5zM7 11a1 1 0 011-1h4a1 1 0 110 2H8a1 1 0 01-1-1z" clipRule="evenodd" />
                        </>
                    ),
                },
                {
                    name: 'Open flow',
                    link: '/openflow',
                    svgPath: (
                        <path fillRule="evenodd" d="M4.5 2A1.5 1.5 0 003 3.5v13A1.5 1.5 0 004.5 18h11a1.5 1.5 0 001.5-1.5V7.621a1.5 1.5 0 00-.44-1.06l-4.12-4.122A1.5 1.5 0 0011.378 2H4.5zm2.25 8.5a.75.75 0 000 1.5h6.5a.75.75 0 000-1.5h-6.5zm0 3a.75.75 0 000 1.5h6.5a.75.75 0 000-1.5h-6.5z" clipRule="evenodd" />
                    ),
                },
                {
                    name: 'Open job',
                    link: '/openjob',
                    svgPath: (
                        <path d="M4.75 3A1.75 1.75 0 003 4.75v2.752l.104-.002h13.792c.035 0 .07 0 .104.002V6.75A1.75 1.75 0 0015.25 5h-3.836a.25.25 0 01-.177-.073L9.823 3.513A1.75 1.75 0 008.586 3H4.75zM3.104 9a1.75 1.75 0 00-1.673 2.265l1.385 4.5A1.75 1.75 0 004.488 17h11.023a1.75 1.75 0 001.673-1.235l1.384-4.5A1.75 1.75 0 0016.896 9H3.104z" />
                    ),
                },
            ]
        },
        {
            name: 'Edit',
            svgPath: (
                <>
                    <path d="M5.433 13.917l1.262-3.155A4 4 0 017.58 9.42l6.92-6.918a2.121 2.121 0 013 3l-6.92 6.918c-.383.383-.84.685-1.343.886l-3.154 1.262a.5.5 0 01-.65-.65z" />
                    <path d="M3.5 5.75c0-.69.56-1.25 1.25-1.25H10A.75.75 0 0010 3H4.75A2.75 2.75 0 002 5.75v9.5A2.75 2.75 0 004.75 18h9.5A2.75 2.75 0 0017 15.25V10a.75.75 0 00-1.5 0v5.25c0 .69-.56 1.25-1.25 1.25h-9.5c-.69 0-1.25-.56-1.25-1.25v-9.5z" />
                </>
            ),
            items: [
                {
                    name: 'Undo',
                    link: '/undo',
                    svgPath: (
                        <path fillRule="evenodd" d="M7.793 2.232a.75.75 0 01-.025 1.06L3.622 7.25h10.003a5.375 5.375 0 010 10.75H10.75a.75.75 0 010-1.5h2.875a3.875 3.875 0 000-7.75H3.622l4.146 3.957a.75.75 0 01-1.036 1.085l-5.5-5.25a.75.75 0 010-1.085l5.5-5.25a.75.75 0 011.06.025z" clipRule="evenodd" />
                    ),
                },
                {
                    name: 'Redo',
                    link: '/redo',
                    svgPath: (
                        <path fillRule="evenodd" d="M12.207 2.232a.75.75 0 00.025 1.06l4.146 3.958H6.375a5.375 5.375 0 000 10.75H9.25a.75.75 0 000-1.5H6.375a3.875 3.875 0 010-7.75h10.003l-4.146 3.957a.75.75 0 001.036 1.085l5.5-5.25a.75.75 0 000-1.085l-5.5-5.25a.75.75 0 00-1.06.025z" clipRule="evenodd" />
                    ),
                },
                {
                    name: 'Copy',
                    link: '/copy',
                    svgPath: (
                        <path fillRule="evenodd" d="M13.887 3.182c.396.037.79.08 1.183.128C16.194 3.45 17 4.414 17 5.517V16.75A2.25 2.25 0 0114.75 19h-9.5A2.25 2.25 0 013 16.75V5.517c0-1.103.806-2.068 1.93-2.207.393-.048.787-.09 1.183-.128A3.001 3.001 0 019 1h2c1.373 0 2.531.923 2.887 2.182zM7.5 4A1.5 1.5 0 019 2.5h2A1.5 1.5 0 0112.5 4v.5h-5V4z" clipRule="evenodd" />
                    ),
                },
                {
                    name: 'Cut',
                    link: '/cut',
                    svgPath: (<>
                        <path fillRule="evenodd" d="M1.469 3.75a3.5 3.5 0 005.617 4.11l.883.51c.025.092.147.116.21.043a3.75 3.75 0 01.5-.484c.286-.23.3-.709-.018-.892l-.825-.477A3.501 3.501 0 001.47 3.75zm2.03 3.482a2 2 0 112-3.464 2 2 0 01-2 3.464zM9.956 8.322a2.75 2.75 0 00-1.588 1.822L7.97 11.63l-.884.51a3.501 3.501 0 10.75 1.3l10.68-6.166a.75.75 0 00-.182-1.374l-.703-.189a2.75 2.75 0 00-1.78.123L9.955 8.322zM2.768 15.5a2 2 0 113.464-2 2 2 0 01-3.464 2z" clipRule="evenodd" />
                        <path d="M12.52 11.89a.5.5 0 00.056.894l3.274 1.381a2.75 2.75 0 001.78.123l.704-.188a.75.75 0 00.18-1.374l-3.47-2.004a.5.5 0 00-.5 0L12.52 11.89z" />
                    </>
                    ),
                },
                {
                    name: 'Paste',
                    link: '/paste',
                    svgPath: (<>
                        <path fillRule="evenodd" d="M15.988 3.012A2.25 2.25 0 0118 5.25v6.5A2.25 2.25 0 0115.75 14H13.5V7A2.5 2.5 0 0011 4.5H8.128a2.252 2.252 0 011.884-1.488A2.25 2.25 0 0112.25 1h1.5a2.25 2.25 0 012.238 2.012zM11.5 3.25a.75.75 0 01.75-.75h1.5a.75.75 0 01.75.75v.25h-3v-.25z" clipRule="evenodd" />
                        <path fillRule="evenodd" d="M2 7a1 1 0 011-1h8a1 1 0 011 1v10a1 1 0 01-1 1H3a1 1 0 01-1-1V7zm2 3.25a.75.75 0 01.75-.75h4.5a.75.75 0 010 1.5h-4.5a.75.75 0 01-.75-.75zm0 3.5a.75.75 0 01.75-.75h4.5a.75.75 0 010 1.5h-4.5a.75.75 0 01-.75-.75z" clipRule="evenodd" />
                    </>
                    ),
                },
            ],
        },
        {
            name: 'View',
            svgPath: (<>
                <path d="M10 12.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5z" />
                <path fillRule="evenodd" d="M.664 10.59a1.651 1.651 0 010-1.186A10.004 10.004 0 0110 3c4.257 0 7.893 2.66 9.336 6.41.147.381.146.804 0 1.186A10.004 10.004 0 0110 17c-4.257 0-7.893-2.66-9.336-6.41zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
            </>
            ),
            items: [
                {
                    name: 'Toggle console',
                    onClick: () => { toggleConsole() },
                    svgPath: (
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="none" className="w-5 h-5">
                            <path fillRule="evenodd" d="M3.25 3A2.25 2.25 0 001 5.25v9.5A2.25 2.25 0 003.25 17h13.5A2.25 2.25 0 0019 14.75v-9.5A2.25 2.25 0 0016.75 3H3.25zm.943 8.752a.75.75 0 01.055-1.06L6.128 9l-1.88-1.693a.75.75 0 111.004-1.114l2.5 2.25a.75.75 0 010 1.114l-2.5 2.25a.75.75 0 01-1.06-.055zM9.75 10.25a.75.75 0 000 1.5h2.5a.75.75 0 000-1.5h-2.5z" clipRule="evenodd" />
                        </svg>
                    ),
                    // Set a keyShortcut to enable keyboard navigation.
                    keyShortcut: "ctrl+T"
                },
                {
                    name: 'Zoom In',
                    link: '/zoom-in',
                    svgPath: (<>
                        <path d="M9 6a.75.75 0 01.75.75v1.5h1.5a.75.75 0 010 1.5h-1.5v1.5a.75.75 0 01-1.5 0v-1.5h-1.5a.75.75 0 010-1.5h1.5v-1.5A.75.75 0 019 6z" />
                        <path fillRule="evenodd" d="M2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9zm7-5.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11z" clipRule="evenodd" />
                    </>),
                },
                {
                    name: 'Zoom Out',
                    link: '/zoom-out',
                    svgPath: (<>
                        <path d="M6.75 8.25a.75.75 0 000 1.5h4.5a.75.75 0 000-1.5h-4.5z" />
                        <path fillRule="evenodd" d="M9 2a7 7 0 104.391 12.452l3.329 3.328a.75.75 0 101.06-1.06l-3.328-3.329A7 7 0 009 2zM3.5 9a5.5 5.5 0 1111 0 5.5 5.5 0 01-11 0z" clipRule="evenodd" />
                    </>
                    ),
                },
            ],
        },
        {
            name: 'Extensions',
            svgPath: (
                <path d="M12 4.467c0-.405.262-.75.559-1.027.276-.257.441-.584.441-.94 0-.828-.895-1.5-2-1.5s-2 .672-2 1.5c0 .362.171.694.456.953.29.265.544.6.544.994a.968.968 0 01-1.024.974 39.655 39.655 0 01-3.014-.306.75.75 0 00-.847.847c.14.993.242 1.999.306 3.014A.968.968 0 014.447 10c-.393 0-.729-.253-.994-.544C3.194 9.17 2.862 9 2.5 9 1.672 9 1 9.895 1 11s.672 2 1.5 2c.356 0 .683-.165.94-.441.276-.297.622-.559 1.027-.559a.997.997 0 011.004 1.03 39.747 39.747 0 01-.319 3.734.75.75 0 00.64.842c1.05.146 2.111.252 3.184.318A.97.97 0 0010 16.948c0-.394-.254-.73-.545-.995C9.171 15.693 9 15.362 9 15c0-.828.895-1.5 2-1.5s2 .672 2 1.5c0 .356-.165.683-.441.94-.297.276-.559.622-.559 1.027a.998.998 0 001.03 1.005c1.337-.05 2.659-.162 3.961-.337a.75.75 0 00.644-.644c.175-1.302.288-2.624.337-3.961A.998.998 0 0016.967 12c-.405 0-.75.262-1.027.559-.257.276-.584.441-.94.441-.828 0-1.5-.895-1.5-2s.672-2 1.5-2c.362 0 .694.17.953.455.265.291.601.545.995.545a.97.97 0 00.976-1.024 41.159 41.159 0 00-.318-3.184.75.75 0 00-.842-.64c-1.228.164-2.473.271-3.734.319A.997.997 0 0112 4.467z" />
            ),
            items: [
                {
                    name: 'NBDSuite Results',
                    link: '/plugins/pages',
                    svgPath: (<path d="M12 4.467c0-.405.262-.75.559-1.027.276-.257.441-.584.441-.94 0-.828-.895-1.5-2-1.5s-2 .672-2 1.5c0 .362.171.694.456.953.29.265.544.6.544.994a.968.968 0 01-1.024.974 39.655 39.655 0 01-3.014-.306.75.75 0 00-.847.847c.14.993.242 1.999.306 3.014A.968.968 0 014.447 10c-.393 0-.729-.253-.994-.544C3.194 9.17 2.862 9 2.5 9 1.672 9 1 9.895 1 11s.672 2 1.5 2c.356 0 .683-.165.94-.441.276-.297.622-.559 1.027-.559a.997.997 0 011.004 1.03 39.747 39.747 0 01-.319 3.734.75.75 0 00.64.842c1.05.146 2.111.252 3.184.318A.97.97 0 0010 16.948c0-.394-.254-.73-.545-.995C9.171 15.693 9 15.362 9 15c0-.828.895-1.5 2-1.5s2 .672 2 1.5c0 .356-.165.683-.441.94-.297.276-.559.622-.559 1.027a.998.998 0 001.03 1.005c1.337-.05 2.659-.162 3.961-.337a.75.75 0 00.644-.644c.175-1.302.288-2.624.337-3.961A.998.998 0 0016.967 12c-.405 0-.75.262-1.027.559-.257.276-.584.441-.94.441-.828 0-1.5-.895-1.5-2s.672-2 1.5-2c.362 0 .694.17.953.455.265.291.601.545.995.545a.97.97 0 00.976-1.024 41.159 41.159 0 00-.318-3.184.75.75 0 00-.842-.64c-1.228.164-2.473.271-3.734.319A.997.997 0 0112 4.467z" />
                    ),
                    onClick: () => {
                        try {
                            const iframe = document.getElementById("plugin-page-iframe") as HTMLIFrameElement;
                            iframe.src = "/plugins/pages/nbdsuiteplugin.pele_results"
                        }
                        catch {
                            console.log("Error loading iframe")
                        }
                    }
                },
            ],
        },

    ]

    return (
        <div className="z-10 flex flex-row justify-between toolbar mt-1" >
            <div className="flex flex-row gap-1 ml-1 mr-1">
                {menus.map((menu, index) => (
                    <ToolbarMenu key={index} {...menu} />
                ))}
            </div>
            <div className="mr-1">
                <SearchComponent />
            </div>
        </div >
    )
}

export { SearchComponent }
