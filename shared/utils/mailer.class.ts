import nodemailer from "nodemailer";
import util from "util";
import log from "./log";
import config from "./config";

type Props = { html: string; receiver: string; subject: string };
class Mailer {
  send = async ({ html, receiver, subject }: Props) => {
    const response = await this.sendMail({ receiver, subject, html });
    log.info(`is mail sent: ${response}`);
    return response;
  };

  private removeHTML = (html: string) => {
    if (!html || html === "") return html;
    return html.toString().replace(/(<([^>]+)>)/gi, "");
  };

  sendMail = async ({ receiver, subject, html }: Props) => {
    const port = parseInt(config.SMTP_PORT);
    const user = config.SMTP_USERNAME;
    const pass = config.SMTP_PASSWORD;
    const host = config.SMTP_HOST;

    const transporter = nodemailer.createTransport({
      port,
      host,
      secure: port === 465,
      auth: { user, pass },
    });

    const mailData = {
      from: `Quyx Notifications <${user}>`,
      to: receiver,
      subject: subject,
      text: this.removeHTML(html),
      html: html,
    };

    const sendMailPromise = util.promisify(transporter.sendMail).bind(transporter);
    try {
      await sendMailPromise(mailData);

      return true;
    } catch (e: any) {
      log.error(e);

      return false;
    }
  };
}

export const mailerSdk = new Mailer();
