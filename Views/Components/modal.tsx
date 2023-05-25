import React, { useState } from 'react';
import Button from 'react-bootstrap/Button';
import Modal from 'react-bootstrap/Modal';

interface HorusModalProps {
    show: boolean;
    onHide?: () => void;
    header: React.ReactNode;
    body: React.ReactNode;
    footer: React.ReactNode
}

function HorusModal(props: HorusModalProps) {
    return (
        <>
            <Modal show={props.show} onHide={props.onHide}>
                <Modal.Header closeButton>
                    <Modal.Title>{props.header}</Modal.Title>
                </Modal.Header>
                <Modal.Body>{props.body}</Modal.Body>
                <Modal.Footer>
                    {props.footer}
                </Modal.Footer>
            </Modal>
        </>
    );
}

export default HorusModal;