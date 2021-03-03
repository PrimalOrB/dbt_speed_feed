import { sfmTable } from './tables.js';
import { runCalculate } from './calculation.js'

// the tool inputs from DOM
var toolInput = {}
// the output object to send to the calculator
var outputObj = {}

// Listener for change to update the output data
window.addEventListener('change', function(e) {
    if(e.target.id === 'series') { // collect refresh material list and collect tool type
        updateMaterials(e)
        output(e)
    } else if ( e.target.id === 'material' || e.target.id === 'tool-type' ) { // collect drop down selections
        outputObj[`${e.target.id}`] = e.target.selectedOptions[0].innerText
        output(e)
    }  else if( e.target.classList.value === 'collect' ) { // collect other input data
        output(e)
    }
})

// load the list of tool types into the dropdown list from the sfm table
function init() {  
    toolInput.series = [...new Set(sfmTable.map(x => x.series))]
    initialToolList()
}
init();

// load tool list to the DOM and run the updateMaterials to generate the list of materials available
function initialToolList() {
    var list = document.getElementById("series")
    for ( var i = 0; i < toolInput.series.length; i++) {
        list.insertAdjacentHTML('beforeend',`<option value="">${toolInput.series[i]}</a>`)
    }
    toolInput['series'] = toolInput.series[0]
    var e = toolInput
    updateMaterials(e)
}

// update the list of materials available from the tol type list
function updateMaterials(e) {
    // if function being called as a change, update the toolInput tool type, otherwise continue with current
    if( e.type === 'change') {
        toolInput[`${e.target.id}`] = e.target.selectedOptions[0].innerText
    }
    // send current tool type to output
    outputObj['series'] = toolInput['series']
    // call material list
    materialList()
}

// load the list of available materials (by tool type) to the dropdown list
function materialList() {
    var e = toolInput['series']
    var list = document.getElementById("material")
    // clear current DOM dropdown list
    list.innerHTML = "";
    var matList = sfmTable.filter(lookup => lookup.series == e)
    for ( var i = 0; i < matList.length; i++) {
        list.insertAdjacentHTML('beforeend',`<option value="${matList[i].material}">${matList[i].material}</a>`)
    }
    // send material type to output
    outputObj['material'] = document.getElementById('material').value
}

// populate output object
function output(e) {
    // send collect class data to output
    var data = document.querySelectorAll('.collect')
    for( var i = 0 ; i < data.length ; i++) {
        // if data is number, store as number
        if( isNaN( parseFloat( data[i].value ) ) ) {
            outputObj[`${data[i].id}`] = data[i].value
        } else {
            outputObj[`${data[i].id}`] = parseFloat( data[i].value )
        }
    }
    post( runCalculate(outputObj) )
}

function post(e) {
    var postDOM = document.getElementById('post')
    postDOM.innerHTML = "";
    for ( const [key, value] of Object.entries(e) ) {
        postDOM.insertAdjacentHTML('beforeend',`<li>${key} - ${value.toFixed(4)}</li>`)
    }
}

