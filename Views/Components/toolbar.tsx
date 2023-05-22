// Desc: This is the toolbar component

import React from 'react'
import {
    useState
} from 'react'

import "./toolbar.css"

import { useNavigate } from 'react-router'

interface ToolBarItemProps {
    name: string,
    link: string,
    icon: React.ReactNode,
}

function ToolBarItem(props: ToolBarItemProps) {

    const navigate = useNavigate()

    const navigateTo = () => {
        navigate(props.link)
    }

    return (
        <button className="flex flex-row toolbar-item cursor-pointer" onClick={navigateTo}>
            {props.icon}
            <p>{props.name}</p>
        </button>
    )
}

function ToolBarSearch() {
    return (
        <div className="flex flex-row" style={
            {
                // Translate the search bar 1.2 rem right to
                // compensate the icon shift
                // Therefore it looks like inside the search bar
                transform: "translateX(1.2rem)"
            }
        }>
            <input type="text" placeholder="Search..." className="toolbar-search" />
            <button style={
                {
                    // Translate the icon 1 px left
                    transform: "translateX(-1.6rem)",
                }
            }>
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

    const menus = [
        {
            name: 'Home',
            link: '/',
            icon: (
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
                </svg>
            )

        },
        {
            name: 'File',
            link: '/newjob',
            icon: (
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                </svg>
            )
        },
        {
            name: 'Edit',
            link: '/contact',
            icon: (
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                </svg>
            )
        },
        {
            name: 'View',
            link: '/contact',
            icon: (
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
            )
        }
    ]

    return (
        <div className="z-10 flex flex-row justify-between toolbar">
            <div className="flex flex-row gap-1 ml-1 mr-1">
                {
                    menus.map((menu) => {
                        return (
                            <ToolBarItem {...menu} />
                        )
                    })
                }
            </div>
            <ToolBarSearch />
        </div>
    )
}