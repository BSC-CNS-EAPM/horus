import io
import logging
import os


class PrintTruncator(io.StringIO):
    """
    Base class for all the print capturers,
    as it incorportates the truncator for long file lengths
    """

    max_log_len: int
    """
    Maximum log length, editable using the HORUS_LOG_LENGTH environment variable
    """

    DEFAULT_LINE_LENGTH = 5000

    def __init__(self, *args, **kwargs) -> None:

        # Issues when lines are too big...
        # We must truncate the outputs of the log files
        try:
            self.max_log_len = int(os.getenv("HORUS_LOG_LENGTH", str(self.DEFAULT_LINE_LENGTH)))
        except ValueError as e:
            logging.getLogger("Horus").error("Failed to get HORUS_LOG_LENGTH: %s", e)
            os.putenv("HORUS_LOG_LENGTH", str(self.DEFAULT_LINE_LENGTH))
            self.max_log_len = self.DEFAULT_LINE_LENGTH

        super().__init__(*args, **kwargs)

    def format(self, message: str) -> str:
        """
        Returns the truncated line
        """

        if len(message) > self.max_log_len:
            message = message[
                : self.max_log_len
            ] + " ... (truncated, max line length: {max_log_len})".format(
                max_log_len=self.max_log_len
            )

        return message
