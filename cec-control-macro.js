/*********************************************************
 * 
 * Author:              William Mills
 *                    	Technical Solutions Specialist 
 *                    	wimills@cisco.com
 *                    	Cisco Systems
 * 
 * Version: 1-0-0
 * Released: 07/01/25
 * 
 * This is an example macro showing how to control a playback 
 * device via HDMI CEC from a Cisco Collaboration Device
 * 
 * Full Readme, source code and license details are available here:
 * https://github.com/wxsd-sales/cec-control-macro
 * 
 ********************************************************/

import xapi from 'xapi';

/*********************************************************
 * Configure the settings below
**********************************************************/

const config = {
  button: {
    name: 'Apple TV',       // UI Extension Button and Panel/Page Name
    color: '',              // UI Extension Icon
    icon: 'Tv',             // UI Extension Icon - Can be defaults or URL
    order: 1                // Preferred Panel Order
  },
  cecDevice:{
    connectorId: 2,         // Playback Device Video Input Connector Id
    logicalAddress: 4       // HDMI Logical Address
  },
  panelId: 'appleTV'        // Base PanelId for Panel, Page and Widgets
}


/*********************************************************
 * Main functions and event subscriptions
**********************************************************/

createPanel();

// Subscribe to Page Open and Close Events
xapi.Event.UserInterface.Extensions.Page.Action.on(({ PageId, Type }) => {
  if (PageId != config.panelId) return
  console.log(`[${config.panelId}] was ${Type}`)
  if (Type == 'Cpened') return xapi.Command.Presentation.Stop();
  xapi.Command.Presentation.Start({ ConnectorId: config.cecDevice.connectorId });
})

// Subscribe to Widget Action Events
xapi.Event.UserInterface.Extensions.Widget.Action.on(({ Type, WidgetId, Value }) => {
  if (!WidgetId.startsWith(config.panelId)) return
  if(Type !='clicked') return
  const [_widgetbase, widget] = WidgetId.split('-')
  if ( widget == 'navigator') {
    const converted = (Value == 'center') ? 'Ok' : Value.charAt(0).toUpperCase() + Value.slice(1)
    return sendCECKey(converted);
  }
  sendCECKey(widget);
});


/*********************************************************
 * Sends NamedKey to the playback device on configured the
 * connector Id with the configured logical address
 **********************************************************/
function sendCECKey(NamedKey) {
  const ConnectorId = config.cecDevice.connectorId;
  const LogicalAddress = config.cecDevice.logicalAddress;
  console.log(`Sending: Video CEC Input KeyClick ConnectorId: ${ConnectorId} - LogicalAddress: ${LogicalAddress} - NamedKey: - ${NamedKey}`);
  xapi.Command.Video.CEC.Input.KeyClick({ ConnectorId, LogicalAddress, NamedKey })
}


/*********************************************************
 * Creates and saves UI Extension Panel based on config
 **********************************************************/
async function createPanel() {
  const panelId = config.panelId;
  const button = config.button;
  const icon = button.icon.startsWith('http') ?  await getIcon(button.icon) : `<Icon>${button.icon}</Icon>`;
  const order = await panelOrder(panelId, button?.order);
  const location = await xapi.Command.MicrosoftTeams.List({ Show: 'Installed' })
    .then(() => 'ControlPanel')
    .catch(() => 'HomeScreen')

  const panel = `
    <Extensions>
    <Panel>
      <PanelId>${panelId}</PanelId>
      <Location>${location}</Location>
      ${icon}
      ${order}
      <Name>${button.name}</Name>
      <Page>
        <Name>${button.name}</Name>
        <Row>
          <Widget>
            <WidgetId>${panelId}-navigator</WidgetId>
            <Type>DirectionalPad</Type>
            <Options>size=4</Options>
          </Widget>
          <Widget>
            <WidgetId>${panelId}-Back</WidgetId>
            <Type>Button</Type>
            <Options>size=1;icon=list</Options>
          </Widget>
          <Widget>
            <WidgetId>${panelId}-Play</WidgetId>
            <Type>Button</Type>
            <Options>size=1;icon=play_pause</Options>
          </Widget>
        </Row>
        <PageId>${panelId}</PageId>
        <Options>hideRowNames=1</Options>
      </Page>
    </Panel>
  </Extensions>`;

  console.log('Creating Panel:', panelId, ' - Location:', location)
  return xapi.Command.UserInterface.Extensions.Panel.Save({ PanelId: panelId }, panel);
}

/*********************************************************
 * Downloads Icon from provided URL and returns the 
 * Icon Id as the required UI Extension XML string
 **********************************************************/
function getIcon(url) {
  return xapi.Command.UserInterface.Extensions.Icon.Download({ Url: url })
    .then(result => `<Icon>Custom</Icon><CustomIcon><Id>${result.IconId}</Id></CustomIcon>`)
    .catch(error => {
      console.log('Unable to download icon: ' + error.message)
      return false
    })
}

/*********************************************************
 * Gets the current Panel Order if exiting Macro panel is present
 * to preserve the order in relation to other custom UI Extensions
 **********************************************************/
async function panelOrder(panelId, preferred) {
  preferred = typeof preferred == 'number' ? `<Order>${preferred}</Order>` : '';
  const list = await xapi.Command.UserInterface.Extensions.List({ ActivityType: "Custom" });
  const panels = list?.Extensions?.Panel
  if (!panels) return preferred
  const existingPanel = panels.find(panel => panel.PanelId == panelId)
  if (!existingPanel) return preferred
  return `<Order>${existingPanel.Order}</Order>`
}
